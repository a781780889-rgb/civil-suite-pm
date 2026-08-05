// lib/hse/db/notifications.js
// نفس نمط lib/equipment/db/notifications.js تماماً: upsert بالاعتماد على قيد UNIQUE على
// dedup_key بدل SELECT-then-INSERT (تفادي أي سباق race condition حقيقي، وليس مجرد نظري -
// هذا هو المقصود حرفياً بمنع تكرار التنبيهات في البند 25).
import { hdb } from '../schema.js';

export function upsertNotification({ project_id, type, severity = 'info', title, message, related_entity_type, related_entity_id, dedup_key }) {
  const db = hdb();
  db.prepare(
    `INSERT INTO hse_notifications (project_id, type, severity, title, message, related_entity_type, related_entity_id, dedup_key)
     VALUES (@project_id, @type, @severity, @title, @message, @related_entity_type, @related_entity_id, @dedup_key)
     ON CONFLICT(dedup_key) DO UPDATE SET
       title = excluded.title, message = excluded.message, severity = excluded.severity,
       is_read = 0, created_at = datetime('now')`
  ).run({
    project_id: project_id ?? null, type, severity, title, message: message || null,
    related_entity_type: related_entity_type || null, related_entity_id: related_entity_id ?? null, dedup_key,
  });
}

export function listNotifications({ project_id, is_read, page = 1, pageSize = 20 } = {}) {
  const db = hdb();
  let where = ' WHERE 1=1';
  const params = {};
  if (project_id) { where += ' AND project_id = @project_id'; params.project_id = project_id; }
  if (is_read !== undefined) { where += ' AND is_read = @is_read'; params.is_read = is_read ? 1 : 0; }
  const total = db.prepare(`SELECT COUNT(*) AS c FROM hse_notifications${where}`).get(params).c;
  const unread = db.prepare(`SELECT COUNT(*) AS c FROM hse_notifications WHERE is_read = 0${project_id ? ' AND project_id = @project_id' : ''}`).get(params).c;
  const offset = (page - 1) * pageSize;
  const rows = db.prepare(`SELECT * FROM hse_notifications${where} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: pageSize, offset });
  return { rows, total, unread, page, pageSize };
}

export function markNotificationRead(id) {
  const db = hdb();
  db.prepare(`UPDATE hse_notifications SET is_read = 1 WHERE id = ?`).run(id);
  return db.prepare(`SELECT * FROM hse_notifications WHERE id = ?`).get(id);
}

export function markAllNotificationsRead(project_id) {
  const db = hdb();
  if (project_id) db.prepare(`UPDATE hse_notifications SET is_read = 1 WHERE project_id = ?`).run(project_id);
  else db.prepare(`UPDATE hse_notifications SET is_read = 1`).run();
}
