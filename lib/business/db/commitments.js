// lib/business/db/commitments.js — إدارة الالتزامات، البند الثالث عشر من القواعد الإلزامية.
import { randomUUID } from 'crypto';
import { bdb, COMMITMENT_STATUSES } from '../schema.js';
import { writeBizAudit } from './audit.js';

const FIELDS = ['title', 'entity_type', 'entity_id', 'responsible', 'due_date', 'priority', 'required_action', 'related_document_id'];

export function createCommitment(data) {
  const db = bdb();
  const run = db.transaction(() => {
    if (!data.title) throw new Error('اسم الالتزام مطلوب.');
    const uuid = randomUUID();
    const payload = Object.fromEntries(FIELDS.map((f) => [f, data[f] !== undefined ? data[f] : null]));
    payload.priority = payload.priority || 'medium';
    const info = db
      .prepare(`INSERT INTO biz_commitments (uuid, status, ${FIELDS.join(', ')}) VALUES (@uuid, 'open', ${FIELDS.map((f) => '@' + f).join(', ')})`)
      .run({ uuid, ...payload });
    const created = getCommitmentById(info.lastInsertRowid);
    writeBizAudit(db, { entity_type: 'commitment', entity_id: created.id, action: 'create', before: null, after: created, actor: data.actor });
    return created;
  });
  return run();
}

export function updateCommitment(id, data) {
  const db = bdb();
  const run = db.transaction(() => {
    const before = getCommitmentById(id);
    if (!before) throw new Error('الالتزام غير موجود.');
    const merged = { ...before, ...data };
    const payload = Object.fromEntries(FIELDS.map((f) => [f, merged[f] !== undefined ? merged[f] : null]));
    const status = COMMITMENT_STATUSES.includes(merged.status) ? merged.status : before.status;
    db.prepare(`UPDATE biz_commitments SET ${FIELDS.map((f) => `${f}=@${f}`).join(', ')}, status=@status, updated_at=datetime('now') WHERE id=@id`).run({ ...payload, status, id });
    const after = getCommitmentById(id);
    writeBizAudit(db, { entity_type: 'commitment', entity_id: id, action: 'update', before, after, actor: data.actor });
    return after;
  });
  return run();
}

export function getCommitmentById(id) {
  return bdb().prepare(`SELECT * FROM biz_commitments WHERE id = ?`).get(id);
}

export function listCommitmentsPaged({ status, entity_type, entity_id, overdue, page = 1, pageSize = 30 } = {}) {
  const db = bdb();
  let where = ' WHERE 1=1';
  const params = {};
  if (status) { where += ' AND status = @status'; params.status = status; }
  if (entity_type) { where += ' AND entity_type = @entity_type'; params.entity_type = entity_type; }
  if (entity_id) { where += ' AND entity_id = @entity_id'; params.entity_id = entity_id; }
  if (overdue) { where += ` AND due_date < date('now') AND status = 'open'`; }
  const total = db.prepare(`SELECT COUNT(*) AS n FROM biz_commitments${where}`).get(params).n;
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(200, Math.max(1, Number(pageSize) || 30));
  const rows = db
    .prepare(`SELECT * FROM biz_commitments${where} ORDER BY (status='open') DESC, due_date ASC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: safePageSize, offset: (safePage - 1) * safePageSize });
  return { rows, total, page: safePage, pageSize: safePageSize, totalPages: Math.max(1, Math.ceil(total / safePageSize)) };
}

export function deleteCommitment(id, actor) {
  const db = bdb();
  const run = db.transaction(() => {
    const before = getCommitmentById(id);
    if (!before) return { deleted: false };
    writeBizAudit(db, { entity_type: 'commitment', entity_id: id, action: 'delete', before, after: null, actor });
    db.prepare(`DELETE FROM biz_commitments WHERE id = ?`).run(id);
    return { deleted: true };
  });
  return run();
}

/** يُستدعى عند تحميل لوحة التحكم أو قائمة الالتزامات - يُحدّث فعلياً حالة أي التزام تجاوز تاريخ
 * استحقاقه إلى "متأخر" (بدل الاكتفاء بحسابه في الواجهة فقط) ليصبح قابلاً للتصفية والتصدير. */
export function refreshOverdueCommitments() {
  const info = bdb().prepare(`UPDATE biz_commitments SET status = 'overdue' WHERE status = 'open' AND due_date IS NOT NULL AND due_date < date('now')`).run();
  return { updated: info.changes };
}
