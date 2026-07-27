// lib/business/db/audit.js
import { bdb } from '../schema.js';

/** يُستدعى من داخل كل معاملة إنشاء/تعديل/حذف عبر كل وحدات القسم السادس - نفس نمط writePmAudit. */
export function writeBizAudit(db, { entity_type, entity_id, action, before, after, actor }) {
  db.prepare(
    `INSERT INTO biz_audit_log (entity_type, entity_id, action, before_json, after_json, actor)
     VALUES (@entity_type, @entity_id, @action, @before_json, @after_json, @actor)`
  ).run({
    entity_type,
    entity_id: entity_id ?? null,
    action,
    before_json: before ? JSON.stringify(before) : null,
    after_json: after ? JSON.stringify(after) : null,
    actor: actor || null,
  });
}

export function listBizAuditLog({ entity_type, entity_id, limit = 200 } = {}) {
  const db = bdb();
  let sql = `SELECT * FROM biz_audit_log WHERE 1=1`;
  const params = {};
  if (entity_type) { sql += ` AND entity_type = @entity_type`; params.entity_type = entity_type; }
  if (entity_id) { sql += ` AND entity_id = @entity_id`; params.entity_id = entity_id; }
  sql += ` ORDER BY created_at DESC LIMIT @limit`;
  params.limit = limit;
  return db.prepare(sql).all(params).map((r) => ({
    ...r,
    before: r.before_json ? JSON.parse(r.before_json) : null,
    after: r.after_json ? JSON.parse(r.after_json) : null,
  }));
}
