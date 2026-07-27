// lib/business/db/quotes.js — إدارة عروض الأسعار، البند الرابع من القواعد الإلزامية.
// مرتبط مباشرة بحصر الكميات (boq_element_id في كل بند) وبالفرصة التجارية والعميل - لا بيانات مكررة.
import { randomUUID } from 'crypto';
import { bdb, QUOTE_STATUSES } from '../schema.js';
import { writeBizAudit } from './audit.js';
import { recordApproval } from './approvals.js';
import { computeQuoteTotals } from '../calc.js';
import { getClientById } from './clients.js';

const HEADER_FIELDS = [
  'quote_no', 'client_id', 'opportunity_id', 'project_id', 'title', 'issue_date', 'validity_date',
  'payment_terms', 'execution_duration_days', 'discount_pct', 'tax_pct', 'other_costs', 'currency', 'notes',
];

function recalcTotals(db, quoteId) {
  const items = db.prepare(`SELECT * FROM biz_quote_items WHERE quote_id = ? ORDER BY sort_order ASC, id ASC`).all(quoteId);
  const quote = db.prepare(`SELECT discount_pct, tax_pct, other_costs FROM biz_quotes WHERE id = ?`).get(quoteId);
  const totals = computeQuoteTotals(items, quote);
  db.prepare(`UPDATE biz_quotes SET subtotal=@subtotal, discount_value=@discount_value, tax_value=@tax_value, total=@total, updated_at=datetime('now') WHERE id=@id`)
    .run({ id: quoteId, ...totals });
  return totals;
}

export function findDuplicateQuoteNo(quoteNo, excludeId) {
  if (!quoteNo) return null;
  const db = bdb();
  return (excludeId
    ? db.prepare(`SELECT * FROM biz_quotes WHERE quote_no = @c AND id != @id`).get({ c: quoteNo, id: excludeId })
    : db.prepare(`SELECT * FROM biz_quotes WHERE quote_no = @c`).get({ c: quoteNo })) || null;
}

export function createQuote(data) {
  const db = bdb();
  const run = db.transaction(() => {
    if (!getClientById(data.client_id)) throw new Error('العميل غير موجود.');
    if (!data.title) throw new Error('عنوان عرض السعر مطلوب.');
    const uuid = randomUUID();
    const payload = Object.fromEntries(HEADER_FIELDS.map((f) => [f, data[f] !== undefined ? data[f] : null]));
    payload.currency = payload.currency || 'SAR';
    payload.discount_pct = Number(payload.discount_pct) || 0;
    payload.tax_pct = Number(payload.tax_pct) || 0;
    payload.other_costs = Number(payload.other_costs) || 0;
    const info = db
      .prepare(`INSERT INTO biz_quotes (uuid, status, ${HEADER_FIELDS.join(', ')}) VALUES (@uuid, 'draft', ${HEADER_FIELDS.map((f) => '@' + f).join(', ')})`)
      .run({ uuid, ...payload });
    const quoteId = info.lastInsertRowid;
    for (const item of data.items || []) {
      insertItem(db, quoteId, item);
    }
    recalcTotals(db, quoteId);
    const created = getQuoteById(quoteId);
    writeBizAudit(db, { entity_type: 'quote', entity_id: quoteId, action: 'create', before: null, after: created, actor: data.actor });
    return created;
  });
  return run();
}

function insertItem(db, quoteId, item, sortOrder) {
  db.prepare(
    `INSERT INTO biz_quote_items (quote_id, boq_element_id, sort_order, description, unit, quantity, unit_price, discount_pct, tax_pct, line_total)
     VALUES (@quote_id, @boq_element_id, @sort_order, @description, @unit, @quantity, @unit_price, @discount_pct, @tax_pct, 0)`
  ).run({
    quote_id: quoteId,
    boq_element_id: item.boq_element_id || null,
    sort_order: sortOrder ?? item.sort_order ?? 0,
    description: item.description || 'بند بدون وصف',
    unit: item.unit || null,
    quantity: Number(item.quantity) || 0,
    unit_price: Number(item.unit_price) || 0,
    discount_pct: Number(item.discount_pct) || 0,
    tax_pct: Number(item.tax_pct) || 0,
  });
}

export function updateQuoteHeader(id, data) {
  const db = bdb();
  const run = db.transaction(() => {
    const before = getQuoteById(id);
    if (!before) throw new Error('عرض السعر غير موجود.');
    if (!['draft', 'under_review'].includes(before.status)) throw new Error('لا يمكن تعديل عرض سعر بعد إرساله - أنشئ مراجعة جديدة بدلاً من ذلك.');
    const merged = { ...before, ...data };
    const payload = Object.fromEntries(HEADER_FIELDS.map((f) => [f, merged[f] !== undefined ? merged[f] : null]));
    db.prepare(`UPDATE biz_quotes SET ${HEADER_FIELDS.map((f) => `${f}=@${f}`).join(', ')}, updated_at=datetime('now') WHERE id=@id`).run({ ...payload, id });
    recalcTotals(db, id);
    const after = getQuoteById(id);
    writeBizAudit(db, { entity_type: 'quote', entity_id: id, action: 'update', before, after, actor: data.actor });
    return after;
  });
  return run();
}

export function replaceQuoteItems(id, items, actor) {
  const db = bdb();
  const run = db.transaction(() => {
    const before = getQuoteById(id);
    if (!before) throw new Error('عرض السعر غير موجود.');
    if (!['draft', 'under_review'].includes(before.status)) throw new Error('لا يمكن تعديل بنود عرض سعر بعد إرساله.');
    db.prepare(`DELETE FROM biz_quote_items WHERE quote_id = ?`).run(id);
    items.forEach((item, i) => insertItem(db, id, item, i));
    const totals = recalcTotals(db, id);
    const after = getQuoteById(id);
    writeBizAudit(db, { entity_type: 'quote', entity_id: id, action: 'update_items', before: { itemsCount: before.itemsCount }, after: { totals }, actor });
    return after;
  });
  return run();
}

export function getQuoteById(id) {
  const db = bdb();
  const quote = db.prepare(`SELECT q.*, c.name AS client_name FROM biz_quotes q LEFT JOIN biz_clients c ON c.id = q.client_id WHERE q.id = ?`).get(id);
  if (!quote) return null;
  quote.items = db.prepare(`SELECT * FROM biz_quote_items WHERE quote_id = ? ORDER BY sort_order ASC, id ASC`).all(id);
  quote.approvals = db.prepare(`SELECT * FROM biz_approvals WHERE entity_type = 'quote' AND entity_id = ? ORDER BY created_at DESC`).all(id);
  return quote;
}

export function listQuotesPaged({ status, client_id, opportunity_id, search, page = 1, pageSize = 30 } = {}) {
  const db = bdb();
  let where = ' WHERE 1=1';
  const params = {};
  if (status) { where += ' AND q.status = @status'; params.status = status; }
  if (client_id) { where += ' AND q.client_id = @client_id'; params.client_id = client_id; }
  if (opportunity_id) { where += ' AND q.opportunity_id = @opportunity_id'; params.opportunity_id = opportunity_id; }
  if (search) { where += ' AND (q.title LIKE @search OR q.quote_no LIKE @search OR c.name LIKE @search)'; params.search = `%${search}%`; }
  const base = ` FROM biz_quotes q LEFT JOIN biz_clients c ON c.id = q.client_id${where}`;
  const total = db.prepare(`SELECT COUNT(*) AS n${base}`).get(params).n;
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(200, Math.max(1, Number(pageSize) || 30));
  const rows = db
    .prepare(`SELECT q.*, c.name AS client_name${base} ORDER BY q.updated_at DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: safePageSize, offset: (safePage - 1) * safePageSize });
  return { rows, total, page: safePage, pageSize: safePageSize, totalPages: Math.max(1, Math.ceil(total / safePageSize)) };
}

/** انتقال حالة عرض السعر عبر Workflow اعتماد حقيقي (البند 18) - يسجّل كل قرار في biz_approvals. */
export function transitionQuoteStatus(id, { status, decision, notes, actor, actor_role }) {
  if (!QUOTE_STATUSES.includes(status)) throw new Error(`حالة عرض سعر غير معروفة: ${status}`);
  const db = bdb();
  const run = db.transaction(() => {
    const before = getQuoteById(id);
    if (!before) throw new Error('عرض السعر غير موجود.');
    db.prepare(`UPDATE biz_quotes SET status=@status, updated_at=datetime('now') WHERE id=@id`).run({ id, status });
    const action = status === 'sent' ? 'submit' : (status === 'won' ? 'approve' : (status === 'lost' ? 'reject' : 'submit'));
    recordApproval(db, { entity_type: 'quote', entity_id: id, action, decision: decision || status, notes, actor, actor_role });
    const after = getQuoteById(id);
    writeBizAudit(db, { entity_type: 'quote', entity_id: id, action: 'status_change', before: { status: before.status }, after: { status }, actor });
    return after;
  });
  return run();
}

export function hardDeleteQuote(id, actor) {
  const db = bdb();
  const run = db.transaction(() => {
    const before = getQuoteById(id);
    if (!before) return { deleted: false };
    if (before.status !== 'draft') throw new Error('لا يمكن حذف عرض سعر بعد إرساله - غيّر حالته بدلاً من ذلك.');
    const linkedContracts = db.prepare(`SELECT COUNT(*) AS n FROM biz_contracts WHERE quote_id = ?`).get(id).n;
    if (linkedContracts > 0) throw new Error('لا يمكن حذف عرض سعر تحوّل بالفعل إلى عقد.');
    writeBizAudit(db, { entity_type: 'quote', entity_id: id, action: 'delete', before, after: null, actor });
    db.prepare(`DELETE FROM biz_quotes WHERE id = ?`).run(id);
    return { deleted: true };
  });
  return run();
}
