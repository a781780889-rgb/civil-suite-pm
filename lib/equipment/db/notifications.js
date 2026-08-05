// lib/equipment/db/notifications.js
// طبقة تخزين التنبيهات - upsert بمفتاح dedup_key فريد يمنع التكرار عند إعادة المسح (البند 23).
import { edb } from '../schema.js';

export function upsertNotification(notif) {
  const db = edb();
  const exists = db.prepare(`SELECT id FROM equipment_notifications WHERE dedup_key = ?`).get(notif.dedup_key);
  if (exists) return null;
  const info = db.prepare(`
    INSERT INTO equipment_notifications (equipment_id, project_id, type, severity, title, message, related_entity_type, related_entity_id, dedup_key)
    VALUES (@equipment_id, @project_id, @type, @severity, @title, @message, @related_entity_type, @related_entity_id, @dedup_key)
  `).run({
    equipment_id: notif.equipment_id ?? null, project_id: notif.project_id ?? null, type: notif.type,
    severity: notif.severity || 'info', title: notif.title, message: notif.message || null,
    related_entity_type: notif.related_entity_type || null, related_entity_id: notif.related_entity_id ?? null,
    dedup_key: notif.dedup_key,
  });
  return info.lastInsertRowid;
}

export function listNotifications({ equipment_id, unreadOnly = false, page = 1, pageSize = 30 } = {}) {
  const db = edb();
  const where = [];
  const params = {};
  if (equipment_id) { where.push('equipment_id = @equipment_id'); params.equipment_id = equipment_id; }
  if (unreadOnly) where.push('is_read = 0');
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS n FROM equipment_notifications ${whereSql}`).get(params).n;
  const unread = db.prepare(`SELECT COUNT(*) AS n FROM equipment_notifications WHERE is_read = 0 ${equipment_id ? 'AND equipment_id = @equipment_id' : ''}`).get(params).n;
  const size = Math.min(200, Math.max(1, Number(pageSize) || 30));
  const offset = (Math.max(1, Number(page) || 1) - 1) * size;
  const rows = db.prepare(`SELECT * FROM equipment_notifications ${whereSql} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`).all({ ...params, limit: size, offset });
  return { rows, total, unread, page: Math.max(1, Number(page) || 1), pageSize: size };
}

export function markNotificationRead(id) {
  edb().prepare(`UPDATE equipment_notifications SET is_read = 1 WHERE id = ?`).run(id);
  return edb().prepare(`SELECT * FROM equipment_notifications WHERE id = ?`).get(id);
}

export function markAllNotificationsRead(equipment_id) {
  const db = edb();
  if (equipment_id) db.prepare(`UPDATE equipment_notifications SET is_read = 1 WHERE equipment_id = ?`).run(equipment_id);
  else db.prepare(`UPDATE equipment_notifications SET is_read = 1`).run();
  return { ok: true };
}
