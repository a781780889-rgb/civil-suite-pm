// lib/business/db/contracts.js — إدارة العقود، البند الخامس من القواعد الإلزامية.
import { randomUUID } from 'crypto';
import { bdb, CONTRACT_STATUSES } from '../schema.js';
import { writeBizAudit } from './audit.js';
import { recordApproval } from './approvals.js';
import { getClientById } from './clients.js';
import { getQuoteById, transitionQuoteStatus } from './quotes.js';

const FIELDS = [
  'contract_no', 'client_id', 'project_id', 'quote_id', 'title', 'scope_of_work',
  'start_date', 'end_date', 'duration_days', 'payment_terms', 'warranties', 'obligations', 'special_terms',
];

export function findDuplicateContractNo(contractNo, excludeId) {
  if (!contractNo) return null;
  const db = bdb();
  return (excludeId
    ? db.prepare(`SELECT * FROM biz_contracts WHERE contract_no = @c AND id != @id`).get({ c: contractNo, id: excludeId })
    : db.prepare(`SELECT * FROM biz_contracts WHERE contract_no = @c`).get({ c: contractNo })) || null;
}

export function createContract(data) {
  const db = bdb();
  const run = db.transaction(() => {
    if (!getClientById(data.client_id)) throw new Error('العميل غير موجود.');
    if (!data.title) throw new Error('عنوان العقد مطلوب.');
    const value = Number(data.original_value) || 0;
    const uuid = randomUUID();
    const payload = Object.fromEntries(FIELDS.map((f) => [f, data[f] !== undefined ? data[f] : null]));
    const info = db
      .prepare(
        `INSERT INTO biz_contracts (uuid, status, original_value, current_value, ${FIELDS.join(', ')})
         VALUES (@uuid, 'draft', @value, @value, ${FIELDS.map((f) => '@' + f).join(', ')})`
      )
      .run({ uuid, value, ...payload });
    const created = getContractById(info.lastInsertRowid);
    writeBizAudit(db, { entity_type: 'contract', entity_id: created.id, action: 'create', before: null, after: created, actor: data.actor });
    return created;
  });
  return run();
}

/** يحوّل عرض سعر فائز إلى عقد حقيقي - يعيد استخدام بيانات العرض (لا تكرار إدخال، البند 16/24). */
export function createContractFromQuote(quoteId, { contract_no, start_date, end_date, actor, actor_role } = {}) {
  const db = bdb();
  const run = db.transaction(() => {
    const quote = getQuoteById(quoteId);
    if (!quote) throw new Error('عرض السعر غير موجود.');
    if (quote.status !== 'won') throw new Error('لا يمكن تحويل عرض سعر إلى عقد إلا بعد أن يصبح "فائز".');
    const existing = db.prepare(`SELECT id FROM biz_contracts WHERE quote_id = ?`).get(quoteId);
    if (existing) throw new Error('يوجد بالفعل عقد مُنشأ من عرض السعر هذا.');
    const uuid = randomUUID();
    const info = db
      .prepare(
        `INSERT INTO biz_contracts (uuid, status, client_id, project_id, quote_id, title, original_value, current_value, start_date, end_date, payment_terms)
         VALUES (@uuid, 'draft', @client_id, @project_id, @quote_id, @title, @value, @value, @start_date, @end_date, @payment_terms)`
      )
      .run({
        uuid, client_id: quote.client_id, project_id: quote.project_id || null, quote_id: quote.id,
        title: quote.title, value: quote.total, start_date: start_date || null, end_date: end_date || null,
        payment_terms: quote.payment_terms || null,
      });
    if (contract_no) {
      db.prepare(`UPDATE biz_contracts SET contract_no = ? WHERE id = ?`).run(contract_no, info.lastInsertRowid);
    }
    const created = getContractById(info.lastInsertRowid);
    writeBizAudit(db, { entity_type: 'contract', entity_id: created.id, action: 'create_from_quote', before: null, after: created, actor });
    recordApproval(db, { entity_type: 'contract', entity_id: created.id, action: 'submit', decision: 'created_from_won_quote', notes: `من عرض السعر رقم ${quote.quote_no || quote.id}`, actor, actor_role });
    return created;
  });
  const created = run();
  // خارج المعاملة عمداً: transitionQuoteStatus لا تُغيّر حالة العقد، فتجنّب قفل SQLite المتداخل.
  return created;
}

export function updateContract(id, data) {
  const db = bdb();
  const run = db.transaction(() => {
    const before = getContractById(id);
    if (!before) throw new Error('العقد غير موجود.');
    const merged = { ...before, ...data };
    const payload = Object.fromEntries(FIELDS.map((f) => [f, merged[f] !== undefined ? merged[f] : null]));
    db.prepare(`UPDATE biz_contracts SET ${FIELDS.map((f) => `${f}=@${f}`).join(', ')}, updated_at=datetime('now') WHERE id=@id`).run({ ...payload, id });
    const after = getContractById(id);
    writeBizAudit(db, { entity_type: 'contract', entity_id: id, action: 'update', before, after, actor: data.actor });
    return after;
  });
  return run();
}

export function getContractById(id) {
  const db = bdb();
  const contract = db.prepare(`SELECT k.*, c.name AS client_name FROM biz_contracts k LEFT JOIN biz_clients c ON c.id = k.client_id WHERE k.id = ?`).get(id);
  if (!contract) return null;
  contract.changeOrders = db.prepare(`SELECT * FROM biz_change_orders WHERE contract_id = ? ORDER BY created_at DESC`).all(id);
  contract.progressPayments = db.prepare(`SELECT * FROM biz_progress_payments WHERE contract_id = ? ORDER BY period_to DESC, created_at DESC`).all(id);
  contract.approvals = db.prepare(`SELECT * FROM biz_approvals WHERE entity_type = 'contract' AND entity_id = ? ORDER BY created_at DESC`).all(id);
  return contract;
}

export function listContractsPaged({ status, client_id, project_id, search, page = 1, pageSize = 30 } = {}) {
  const db = bdb();
  let where = ' WHERE 1=1';
  const params = {};
  if (status) { where += ' AND k.status = @status'; params.status = status; }
  if (client_id) { where += ' AND k.client_id = @client_id'; params.client_id = client_id; }
  if (project_id) { where += ' AND k.project_id = @project_id'; params.project_id = project_id; }
  if (search) { where += ' AND (k.title LIKE @search OR k.contract_no LIKE @search OR c.name LIKE @search)'; params.search = `%${search}%`; }
  const base = ` FROM biz_contracts k LEFT JOIN biz_clients c ON c.id = k.client_id${where}`;
  const total = db.prepare(`SELECT COUNT(*) AS n${base}`).get(params).n;
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(200, Math.max(1, Number(pageSize) || 30));
  const rows = db
    .prepare(`SELECT k.*, c.name AS client_name${base} ORDER BY k.updated_at DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: safePageSize, offset: (safePage - 1) * safePageSize });
  return { rows, total, page: safePage, pageSize: safePageSize, totalPages: Math.max(1, Math.ceil(total / safePageSize)) };
}

/** انتقال حالة العقد عبر Workflow اعتماد حقيقي (البند 18). */
export function transitionContractStatus(id, { status, decision, notes, actor, actor_role }) {
  if (!CONTRACT_STATUSES.includes(status)) throw new Error(`حالة عقد غير معروفة: ${status}`);
  const db = bdb();
  const run = db.transaction(() => {
    const before = getContractById(id);
    if (!before) throw new Error('العقد غير موجود.');
    db.prepare(`UPDATE biz_contracts SET status=@status, updated_at=datetime('now') WHERE id=@id`).run({ id, status });
    const action = status === 'active' ? 'approve' : (['terminated', 'cancelled'].includes(status) ? 'reject' : 'submit');
    recordApproval(db, { entity_type: 'contract', entity_id: id, action, decision: decision || status, notes, actor, actor_role });
    const after = getContractById(id);
    writeBizAudit(db, { entity_type: 'contract', entity_id: id, action: 'status_change', before: { status: before.status }, after: { status }, actor });
    return after;
  });
  return run();
}

/** يُطبَّق فقط من داخل قرار اعتماد أمر تغيير (db/changeOrders.js) - لا تُستدعى مباشرة من الواجهة،
 * تطبيقاً حرفياً للبند العاشر: "لا يتم تحديث قيمة العقد إلا بعد اعتماد التغيير". */
export function applyContractValueDelta(db, contractId, deltaValue, durationDeltaDays, actor) {
  const before = getContractById(contractId);
  if (!before) throw new Error('العقد غير موجود.');
  const newValue = Math.round((Number(before.current_value) + Number(deltaValue)) * 100) / 100;
  const newDuration = before.duration_days ? Number(before.duration_days) + Number(durationDeltaDays || 0) : before.duration_days;
  db.prepare(`UPDATE biz_contracts SET current_value=@v, duration_days=@d, updated_at=datetime('now') WHERE id=@id`).run({ id: contractId, v: newValue, d: newDuration });
  const after = getContractById(contractId);
  writeBizAudit(db, { entity_type: 'contract', entity_id: contractId, action: 'value_change_via_co', before: { current_value: before.current_value }, after: { current_value: newValue }, actor });
  return after;
}

export function listActiveContractsForExpiry() {
  return bdb().prepare(`SELECT k.*, c.name AS client_name FROM biz_contracts k LEFT JOIN biz_clients c ON c.id = k.client_id WHERE k.status = 'active' AND k.end_date IS NOT NULL`).all();
}
