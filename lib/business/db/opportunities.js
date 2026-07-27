// lib/business/db/opportunities.js — إدارة الفرص التجارية، البند الثالث من القواعد الإلزامية.
// المراحل: جديدة → مؤهلة → دراسة → عرض سعر → تفاوض → فوز / خسارة.
import { randomUUID } from 'crypto';
import { bdb, OPPORTUNITY_STAGES } from '../schema.js';
import { writeBizAudit } from './audit.js';
import { getClientById } from './clients.js';

const FIELDS = [
  'opp_code', 'client_id', 'project_id', 'name', 'source', 'expected_value', 'currency',
  'opp_date', 'expected_close_date', 'responsible', 'win_probability', 'stage', 'lost_reason', 'notes',
];

function normalize(data) {
  const out = {};
  for (const f of FIELDS) out[f] = data[f] !== undefined ? data[f] : null;
  if (!out.name) throw new Error('اسم الفرصة مطلوب.');
  if (!out.client_id) throw new Error('العميل المحتمل مطلوب.');
  out.stage = OPPORTUNITY_STAGES.includes(out.stage) ? out.stage : 'new';
  out.currency = out.currency || 'SAR';
  out.expected_value = Number(out.expected_value) || 0;
  out.win_probability = Math.max(0, Math.min(100, Number(out.win_probability) || 0));
  return out;
}

export function createOpportunity(data) {
  const db = bdb();
  const run = db.transaction(() => {
    const n = normalize(data);
    if (!getClientById(n.client_id)) throw new Error('العميل المحتمل غير موجود.');
    const uuid = randomUUID();
    const info = db
      .prepare(`INSERT INTO biz_opportunities (uuid, ${FIELDS.join(', ')}) VALUES (@uuid, ${FIELDS.map((f) => '@' + f).join(', ')})`)
      .run({ uuid, ...n });
    const created = getOpportunityById(info.lastInsertRowid);
    writeBizAudit(db, { entity_type: 'opportunity', entity_id: created.id, action: 'create', before: null, after: created, actor: data.actor });
    return created;
  });
  return run();
}

export function updateOpportunity(id, data) {
  const db = bdb();
  const run = db.transaction(() => {
    const before = getOpportunityById(id);
    if (!before) throw new Error('الفرصة غير موجودة.');
    const merged = { ...before, ...data };
    const n = normalize(merged);
    if (n.stage === 'lost' && !n.lost_reason) throw new Error('سبب الخسارة مطلوب عند تحويل الفرصة إلى "خسارة".');
    db.prepare(`UPDATE biz_opportunities SET ${FIELDS.map((f) => `${f}=@${f}`).join(', ')}, updated_at=datetime('now') WHERE id=@id`).run({ ...n, id });
    const after = getOpportunityById(id);
    writeBizAudit(db, { entity_type: 'opportunity', entity_id: id, action: 'update', before, after, actor: data.actor });
    return after;
  });
  return run();
}

/** تغيير مرحلة الفرصة - يفرض ذكر lost_reason عند التحول إلى "خسارة" (تتبّع/دقة، البند 24). */
export function changeOpportunityStage(id, stage, { lost_reason, actor } = {}) {
  if (!OPPORTUNITY_STAGES.includes(stage)) throw new Error(`مرحلة فرصة غير معروفة: ${stage}`);
  if (stage === 'lost' && !lost_reason) throw new Error('سبب الخسارة مطلوب عند تحويل الفرصة إلى "خسارة".');
  const db = bdb();
  const run = db.transaction(() => {
    const before = getOpportunityById(id);
    if (!before) throw new Error('الفرصة غير موجودة.');
    db.prepare(`UPDATE biz_opportunities SET stage=@stage, lost_reason=@lost_reason, win_probability=@wp, updated_at=datetime('now') WHERE id=@id`)
      .run({ id, stage, lost_reason: stage === 'lost' ? lost_reason : before.lost_reason, wp: stage === 'won' ? 100 : stage === 'lost' ? 0 : before.win_probability });
    const after = getOpportunityById(id);
    writeBizAudit(db, { entity_type: 'opportunity', entity_id: id, action: 'stage_change', before: { stage: before.stage }, after: { stage }, actor });
    return after;
  });
  return run();
}

export function getOpportunityById(id) {
  return bdb().prepare(`SELECT o.*, c.name AS client_name FROM biz_opportunities o LEFT JOIN biz_clients c ON c.id = o.client_id WHERE o.id = ?`).get(id);
}

export function listOpportunitiesPaged({ stage, client_id, search, page = 1, pageSize = 30 } = {}) {
  const db = bdb();
  let where = ' WHERE 1=1';
  const params = {};
  if (stage) { where += ' AND o.stage = @stage'; params.stage = stage; }
  if (client_id) { where += ' AND o.client_id = @client_id'; params.client_id = client_id; }
  if (search) { where += ' AND (o.name LIKE @search OR o.opp_code LIKE @search OR c.name LIKE @search)'; params.search = `%${search}%`; }
  const base = ` FROM biz_opportunities o LEFT JOIN biz_clients c ON c.id = o.client_id${where}`;
  const total = db.prepare(`SELECT COUNT(*) AS n${base}`).get(params).n;
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(200, Math.max(1, Number(pageSize) || 30));
  const rows = db
    .prepare(`SELECT o.*, c.name AS client_name${base} ORDER BY o.updated_at DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: safePageSize, offset: (safePage - 1) * safePageSize });
  return { rows, total, page: safePage, pageSize: safePageSize, totalPages: Math.max(1, Math.ceil(total / safePageSize)) };
}

/** كل الفرص المفتوحة (لبناء لوحة Pipeline وحساب القيمة المرجّحة) - بلا ترقيم صفحات. */
export function listOpenOpportunities() {
  return bdb().prepare(`SELECT o.*, c.name AS client_name FROM biz_opportunities o LEFT JOIN biz_clients c ON c.id = o.client_id WHERE o.stage NOT IN ('won','lost') ORDER BY o.expected_close_date ASC`).all();
}

export function hardDeleteOpportunity(id, actor) {
  const db = bdb();
  const run = db.transaction(() => {
    const before = getOpportunityById(id);
    if (!before) return { deleted: false };
    const linkedQuotes = db.prepare(`SELECT COUNT(*) AS n FROM biz_quotes WHERE opportunity_id = ?`).get(id).n;
    if (linkedQuotes > 0) throw new Error('لا يمكن حذف فرصة مرتبطة بعروض أسعار فعلية.');
    writeBizAudit(db, { entity_type: 'opportunity', entity_id: id, action: 'delete', before, after: null, actor });
    db.prepare(`DELETE FROM biz_opportunities WHERE id = ?`).run(id);
    return { deleted: true };
  });
  return run();
}
