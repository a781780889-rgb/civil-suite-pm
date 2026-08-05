// lib/equipment/db/audit.js
// سجل التدقيق (Audit Log) - البند 25: يسجل كل عملية مهمة مع المستخدم والتاريخ والبيانات
// السابقة/الجديدة. يُستدعى من كل دالة تعديل في طبقة db بدل تكرار منطق التسجيل يدوياً.
import { edb } from '../schema.js';

export function writeAudit({ equipment_id = null, entity_type, entity_id = null, action, before = null, after = null, actor = null }) {
  const db = edb();
  db.prepare(`
    INSERT INTO equipment_audit_log (equipment_id, entity_type, entity_id, action, before_json, after_json, actor)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    equipment_id, entity_type, entity_id, action,
    before != null ? JSON.stringify(before) : null,
    after != null ? JSON.stringify(after) : null,
    actor
  );
}

export function listAuditLog({ equipment_id, entity_type, page = 1, pageSize = 50 } = {}) {
  const db = edb();
  const where = [];
  const params = {};
  if (equipment_id) { where.push('equipment_id = @equipment_id'); params.equipment_id = equipment_id; }
  if (entity_type) { where.push('entity_type = @entity_type'); params.entity_type = entity_type; }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS n FROM equipment_audit_log ${whereSql}`).get(params).n;
  const size = Math.min(200, Math.max(1, Number(pageSize) || 50));
  const offset = (Math.max(1, Number(page) || 1) - 1) * size;
  const rows = db.prepare(`SELECT * FROM equipment_audit_log ${whereSql} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: size, offset })
    .map((r) => ({ ...r, before_json: r.before_json ? JSON.parse(r.before_json) : null, after_json: r.after_json ? JSON.parse(r.after_json) : null }));
  return { rows, total, page: Math.max(1, Number(page) || 1), pageSize: size };
}
