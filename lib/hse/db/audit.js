// lib/hse/db/audit.js
// يسجّل كل عملية مهمة في hse_audit_log (البند 22: "تسجيل جميع العمليات في Audit Log") -
// نفس نمط lib/equipment/db/audit.js وlib/pm/db/audit.js تماماً.
import { hdb } from '../schema.js';

export function writeHseAudit(db, { project_id, entity_type, entity_id, action, before, after, actor }) {
  db.prepare(
    `INSERT INTO hse_audit_log (project_id, entity_type, entity_id, action, before_json, after_json, actor)
     VALUES (@project_id, @entity_type, @entity_id, @action, @before_json, @after_json, @actor)`
  ).run({
    project_id: project_id ?? null,
    entity_type,
    entity_id: entity_id ?? null,
    action,
    before_json: before ? JSON.stringify(before) : null,
    after_json: after ? JSON.stringify(after) : null,
    actor: actor || null,
  });
}

export function listHseAuditLog({ project_id, entity_type, entity_id, page = 1, pageSize = 50 } = {}) {
  const db = hdb();
  let where = ' WHERE 1=1';
  const params = {};
  if (project_id) { where += ' AND project_id = @project_id'; params.project_id = project_id; }
  if (entity_type) { where += ' AND entity_type = @entity_type'; params.entity_type = entity_type; }
  if (entity_id) { where += ' AND entity_id = @entity_id'; params.entity_id = entity_id; }
  const total = db.prepare(`SELECT COUNT(*) AS c FROM hse_audit_log${where}`).get(params).c;
  const offset = (page - 1) * pageSize;
  const rows = db.prepare(`SELECT * FROM hse_audit_log${where} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: pageSize, offset });
  return { rows, total, page, pageSize };
}
