// lib/business/db/notifications.js — تخزين فقط (CRUD بسيط)، نفس نمط lib/pm/db/notifications.js.
import { bdb } from '../schema.js';

/** إدراج تنبيه - يتجاهل بصمت إن كان نفس dedup_key موجوداً بالفعل (لا تكرار/إزعاج). */
export function upsertBizNotification(notif) {
  const db = bdb();
  const info = db
    .prepare(
      `INSERT OR IGNORE INTO biz_notifications (project_id, type, severity, title, message, related_entity_type, related_entity_id, dedup_key)
       VALUES (@project_id, @type, @severity, @title, @message, @related_entity_type, @related_entity_id, @dedup_key)`
    )
    .run({
      project_id: notif.project_id || null,
      type: notif.type,
      severity: notif.severity || 'info',
      title: notif.title,
      message: notif.message || null,
      related_entity_type: notif.related_entity_type || null,
      related_entity_id: notif.related_entity_id || null,
      dedup_key: notif.dedup_key,
    });
  if (info.changes === 0) return null;
  return db.prepare(`SELECT * FROM biz_notifications WHERE id = ?`).get(info.lastInsertRowid);
}

export function listBizNotifications({ is_read, limit = 100 } = {}) {
  const db = bdb();
  let where = ' WHERE 1=1';
  const params = {};
  if (is_read !== undefined && is_read !== null) { where += ' AND is_read = @is_read'; params.is_read = is_read ? 1 : 0; }
  params.limit = limit;
  return db.prepare(`SELECT * FROM biz_notifications${where} ORDER BY created_at DESC LIMIT @limit`).all(params);
}

export function markBizNotificationRead(id, isRead = true) {
  bdb().prepare(`UPDATE biz_notifications SET is_read = ? WHERE id = ?`).run(isRead ? 1 : 0, id);
  return bdb().prepare(`SELECT * FROM biz_notifications WHERE id = ?`).get(id);
}

export function markAllBizRead() {
  const info = bdb().prepare(`UPDATE biz_notifications SET is_read = 1 WHERE is_read = 0`).run();
  return { updated: info.changes };
}

export function countBizUnread() {
  return bdb().prepare(`SELECT COUNT(*) AS n FROM biz_notifications WHERE is_read = 0`).get().n;
}
