// lib/pm/db/notifications.js
// =============================================================================
// طبقة تخزين التنبيهات فقط (CRUD بسيط). تجميع البيانات الحقيقية وقرار "متى يُولَّد تنبيه"
// يعيشان عمداً خارج هذا الملف: التنبيهات الفورية (حدثية) تُستدعى من نفس معاملة الإنشاء في
// الوحدة المعنية (مثال: db/documents.js يستدعي upsertNotification مباشرة بعد رفع مستند)،
// والتنبيهات الزمنية (تأخير المهام، اقتراب التسليم) تُكتَشف عبر مسح عند الطلب في
// app/api/pm/notifications route - هذا يتفادى استيراداً دائرياً بين وحدات db/*.
// =============================================================================

import { pdb } from '../schema.js';

/** إدراج تنبيه - يتجاهل بصمت إن كان نفس dedup_key موجوداً بالفعل (لا تكرار/إزعاج). */
export function upsertNotification(notif) {
  const db = pdb();
  const info = db
    .prepare(
      `INSERT OR IGNORE INTO pm_notifications (project_id, type, severity, title, message, related_entity_type, related_entity_id, dedup_key)
       VALUES (@project_id, @type, @severity, @title, @message, @related_entity_type, @related_entity_id, @dedup_key)`
    )
    .run({
      project_id: notif.project_id,
      type: notif.type,
      severity: notif.severity || 'info',
      title: notif.title,
      message: notif.message || null,
      related_entity_type: notif.related_entity_type || null,
      related_entity_id: notif.related_entity_id || null,
      dedup_key: notif.dedup_key,
    });
  if (info.changes === 0) return null; // كان موجوداً بالفعل
  return db.prepare(`SELECT * FROM pm_notifications WHERE id = ?`).get(info.lastInsertRowid);
}

export function listNotifications({ project_id, is_read, limit = 100 } = {}) {
  const db = pdb();
  let where = ' WHERE 1=1';
  const params = {};
  if (project_id) { where += ' AND project_id = @project_id'; params.project_id = project_id; }
  if (is_read !== undefined && is_read !== null) { where += ' AND is_read = @is_read'; params.is_read = is_read ? 1 : 0; }
  params.limit = limit;
  return db.prepare(`SELECT * FROM pm_notifications${where} ORDER BY created_at DESC LIMIT @limit`).all(params);
}

export function markNotificationRead(id, isRead = true) {
  pdb().prepare(`UPDATE pm_notifications SET is_read = ? WHERE id = ?`).run(isRead ? 1 : 0, id);
  return pdb().prepare(`SELECT * FROM pm_notifications WHERE id = ?`).get(id);
}

export function markAllRead(projectId) {
  const info = pdb().prepare(`UPDATE pm_notifications SET is_read = 1 WHERE project_id = ? AND is_read = 0`).run(projectId);
  return { updated: info.changes };
}

export function countUnread(projectId) {
  return pdb().prepare(`SELECT COUNT(*) AS n FROM pm_notifications WHERE project_id = ? AND is_read = 0`).get(projectId).n;
}
