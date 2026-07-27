// lib/business/db/workOrders.js — إدارة أوامر العمل، البند الثامن من القواعد الإلزامية.
// الحالات: جديد → معتمد → قيد التنفيذ → مكتمل → مغلق.
import { randomUUID } from 'crypto';
import { bdb, WORK_ORDER_STATUSES } from '../schema.js';
import { writeBizAudit } from './audit.js';

const FIELDS = [
  'wo_no', 'project_id', 'client_id', 'contract_id', 'partner_id', 'activity', 'description',
  'responsible', 'issue_date', 'due_date', 'priority', 'cost', 'notes',
];

export function findDuplicateWoNo(woNo, excludeId) {
  if (!woNo) return null;
  const db = bdb();
  return (excludeId
    ? db.prepare(`SELECT * FROM biz_work_orders WHERE wo_no=@c AND id != @id`).get({ c: woNo, id: excludeId })
    : db.prepare(`SELECT * FROM biz_work_orders WHERE wo_no=@c`).get({ c: woNo })) || null;
}

export function createWorkOrder(data) {
  const db = bdb();
  const run = db.transaction(() => {
    if (!data.activity) throw new Error('نشاط أمر العمل مطلوب.');
    const uuid = randomUUID();
    const payload = Object.fromEntries(FIELDS.map((f) => [f, data[f] !== undefined ? data[f] : null]));
    payload.cost = Number(payload.cost) || 0;
    payload.priority = payload.priority || 'medium';
    const info = db
      .prepare(`INSERT INTO biz_work_orders (uuid, status, ${FIELDS.join(', ')}) VALUES (@uuid, 'new', ${FIELDS.map((f) => '@' + f).join(', ')})`)
      .run({ uuid, ...payload });
    const created = getWorkOrderById(info.lastInsertRowid);
    writeBizAudit(db, { entity_type: 'work_order', entity_id: created.id, action: 'create', before: null, after: created, actor: data.actor });
    return created;
  });
  return run();
}

export function updateWorkOrder(id, data) {
  const db = bdb();
  const run = db.transaction(() => {
    const before = getWorkOrderById(id);
    if (!before) throw new Error('أمر العمل غير موجود.');
    const merged = { ...before, ...data };
    const payload = Object.fromEntries(FIELDS.map((f) => [f, merged[f] !== undefined ? merged[f] : null]));
    payload.cost = Number(payload.cost) || 0;
    db.prepare(`UPDATE biz_work_orders SET ${FIELDS.map((f) => `${f}=@${f}`).join(', ')}, updated_at=datetime('now') WHERE id=@id`).run({ ...payload, id });
    const after = getWorkOrderById(id);
    writeBizAudit(db, { entity_type: 'work_order', entity_id: id, action: 'update', before, after, actor: data.actor });
    return after;
  });
  return run();
}

export function getWorkOrderById(id) {
  return bdb()
    .prepare(
      `SELECT w.*, c.name AS client_name, p.company_name AS partner_name, k.title AS contract_title
       FROM biz_work_orders w
       LEFT JOIN biz_clients c ON c.id = w.client_id
       LEFT JOIN biz_partners p ON p.id = w.partner_id
       LEFT JOIN biz_contracts k ON k.id = w.contract_id
       WHERE w.id = ?`
    )
    .get(id);
}

export function listWorkOrdersPaged({ status, project_id, contract_id, partner_id, search, page = 1, pageSize = 30 } = {}) {
  const db = bdb();
  let where = ' WHERE 1=1';
  const params = {};
  if (status) { where += ' AND w.status = @status'; params.status = status; }
  if (project_id) { where += ' AND w.project_id = @project_id'; params.project_id = project_id; }
  if (contract_id) { where += ' AND w.contract_id = @contract_id'; params.contract_id = contract_id; }
  if (partner_id) { where += ' AND w.partner_id = @partner_id'; params.partner_id = partner_id; }
  if (search) { where += ' AND (w.activity LIKE @search OR w.wo_no LIKE @search)'; params.search = `%${search}%`; }
  const base = ` FROM biz_work_orders w LEFT JOIN biz_clients c ON c.id=w.client_id LEFT JOIN biz_partners p ON p.id=w.partner_id${where}`;
  const total = db.prepare(`SELECT COUNT(*) AS n${base}`).get(params).n;
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(200, Math.max(1, Number(pageSize) || 30));
  const rows = db
    .prepare(`SELECT w.*, c.name AS client_name, p.company_name AS partner_name${base} ORDER BY w.updated_at DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: safePageSize, offset: (safePage - 1) * safePageSize });
  return { rows, total, page: safePage, pageSize: safePageSize, totalPages: Math.max(1, Math.ceil(total / safePageSize)) };
}

export function transitionWorkOrderStatus(id, status, actor) {
  if (!WORK_ORDER_STATUSES.includes(status)) throw new Error(`حالة أمر عمل غير معروفة: ${status}`);
  const db = bdb();
  const run = db.transaction(() => {
    const before = getWorkOrderById(id);
    if (!before) throw new Error('أمر العمل غير موجود.');
    db.prepare(`UPDATE biz_work_orders SET status=@status, updated_at=datetime('now') WHERE id=@id`).run({ id, status });
    const after = getWorkOrderById(id);
    writeBizAudit(db, { entity_type: 'work_order', entity_id: id, action: 'status_change', before: { status: before.status }, after: { status }, actor });
    return after;
  });
  return run();
}

export function deleteWorkOrder(id, actor) {
  const db = bdb();
  const run = db.transaction(() => {
    const before = getWorkOrderById(id);
    if (!before) return { deleted: false };
    writeBizAudit(db, { entity_type: 'work_order', entity_id: id, action: 'delete', before, after: null, actor });
    db.prepare(`DELETE FROM biz_work_orders WHERE id = ?`).run(id);
    return { deleted: true };
  });
  return run();
}
