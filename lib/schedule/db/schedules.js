// lib/schedule/db/schedules.js
import { randomUUID } from 'crypto';
import { sdb } from '../schema.js';
import { writePmAudit } from '../../pm/db/audit.js';
import { getOrCreateDefaultCalendar } from './calendars.js';

export function listSchedules({ project_id, status } = {}) {
  const db = sdb();
  let sql = `SELECT s.*, p.name AS project_name, p.project_code FROM sch_schedules s JOIN projects p ON p.id = s.project_id WHERE 1=1`;
  const params = {};
  if (project_id) { sql += ` AND s.project_id=@project_id`; params.project_id = project_id; }
  if (status) { sql += ` AND s.status=@status`; params.status = status; }
  sql += ` ORDER BY s.is_primary DESC, s.created_at DESC`;
  return db.prepare(sql).all(params);
}

export function getSchedule(id) {
  return sdb().prepare(
    `SELECT s.*, p.name AS project_name, p.project_code FROM sch_schedules s JOIN projects p ON p.id = s.project_id WHERE s.id = ?`
  ).get(id);
}

export function createSchedule({ project_id, name, version_label, data_date, notes }, actor) {
  const db = sdb();
  if (!project_id) throw new Error('المشروع مطلوب - كل جدول زمني يجب أن يرتبط بمشروع واحد.');
  const project = db.prepare(`SELECT id FROM projects WHERE id = ?`).get(project_id);
  if (!project) throw new Error('المشروع غير موجود.');

  const calendar = getOrCreateDefaultCalendar(project_id, actor);
  const isFirst = !db.prepare(`SELECT id FROM sch_schedules WHERE project_id = ?`).get(project_id);
  const uuid = randomUUID();

  const info = db.prepare(
    `INSERT INTO sch_schedules (uuid, project_id, name, version_label, status, is_primary, calendar_id, data_date, notes, created_by)
     VALUES (@uuid, @project_id, @name, @version_label, 'active', @is_primary, @calendar_id, @data_date, @notes, @created_by)`
  ).run({
    uuid, project_id, name: name?.trim() || 'الجدول الزمني الرئيسي', version_label: version_label || null,
    is_primary: isFirst ? 1 : 0, calendar_id: calendar.id, data_date: data_date || null, notes: notes || null, created_by: actor || null,
  });
  const row = db.prepare(`SELECT * FROM sch_schedules WHERE id = ?`).get(info.lastInsertRowid);
  writePmAudit(db, { project_id, entity_type: 'schedule', entity_id: row.id, action: 'create', after: row, actor });
  return row;
}

export function updateSchedule(id, data, actor) {
  const db = sdb();
  const before = db.prepare(`SELECT * FROM sch_schedules WHERE id = ?`).get(id);
  if (!before) throw new Error('الجدول الزمني غير موجود.');
  if (before.is_locked) throw new Error('الجدول مُقفل - لا يمكن تعديله إلا بعد فكّ القفل.');

  const merged = {
    name: data.name ?? before.name,
    version_label: data.version_label ?? before.version_label,
    data_date: data.data_date ?? before.data_date,
    notes: data.notes ?? before.notes,
    status: data.status ?? before.status,
    calendar_id: data.calendar_id ?? before.calendar_id,
    is_locked: data.is_locked != null ? (data.is_locked ? 1 : 0) : before.is_locked,
  };
  db.prepare(
    `UPDATE sch_schedules SET name=@name, version_label=@version_label, data_date=@data_date, notes=@notes,
       status=@status, calendar_id=@calendar_id, is_locked=@is_locked, updated_at=datetime('now') WHERE id=@id`
  ).run({ ...merged, id });
  const after = db.prepare(`SELECT * FROM sch_schedules WHERE id = ?`).get(id);
  writePmAudit(db, { project_id: after.project_id, entity_type: 'schedule', entity_id: id, action: 'update', before, after, actor });
  return after;
}

export function archiveSchedule(id, actor) {
  return updateSchedule(id, { status: 'archived' }, actor);
}

/** حذف نهائي - القاعدة الثانية الإلزامية: يُمنع إلا بصلاحيات مدير النظام (يُنفَّذ في مسار الـ API عبر assertPermission قبل الوصول هنا). */
export function hardDeleteSchedule(id, actor) {
  const db = sdb();
  const before = db.prepare(`SELECT * FROM sch_schedules WHERE id = ?`).get(id);
  if (!before) return;
  db.prepare(`DELETE FROM sch_schedules WHERE id = ?`).run(id);
  writePmAudit(db, { project_id: before.project_id, entity_type: 'schedule', entity_id: id, action: 'hard_delete', before, actor });
}

export function setPrimarySchedule(id, actor) {
  const db = sdb();
  const schedule = db.prepare(`SELECT * FROM sch_schedules WHERE id = ?`).get(id);
  if (!schedule) throw new Error('الجدول الزمني غير موجود.');
  const tx = db.transaction(() => {
    db.prepare(`UPDATE sch_schedules SET is_primary = 0 WHERE project_id = ?`).run(schedule.project_id);
    db.prepare(`UPDATE sch_schedules SET is_primary = 1, updated_at = datetime('now') WHERE id = ?`).run(id);
  });
  tx();
  const after = db.prepare(`SELECT * FROM sch_schedules WHERE id = ?`).get(id);
  writePmAudit(db, { project_id: after.project_id, entity_type: 'schedule', entity_id: id, action: 'set_primary', before: schedule, after, actor });
  return after;
}
