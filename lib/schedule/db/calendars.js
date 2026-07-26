// lib/schedule/db/calendars.js
import { randomUUID } from 'crypto';
import { sdb, DEFAULT_WORKING_DAYS } from '../schema.js';
import { writePmAudit } from '../../pm/db/audit.js';

export function listCalendars(projectId) {
  const db = sdb();
  if (projectId) {
    return db.prepare(`SELECT * FROM sch_calendars WHERE project_id = ? OR project_id IS NULL ORDER BY is_default DESC, created_at ASC`).all(projectId);
  }
  return db.prepare(`SELECT * FROM sch_calendars ORDER BY is_default DESC, created_at ASC`).all();
}

export function getCalendar(id) {
  return sdb().prepare(`SELECT * FROM sch_calendars WHERE id = ?`).get(id);
}

export function listExceptions(calendarId) {
  return sdb().prepare(`SELECT * FROM sch_calendar_exceptions WHERE calendar_id = ? ORDER BY exception_date ASC`).all(calendarId);
}

/** يُعيد التقويم الافتراضي للمشروع، منشئاً إياه أول مرة إن لم يوجد بعد (أحد-خميس، 8 ساعات). */
export function getOrCreateDefaultCalendar(projectId, actor) {
  const db = sdb();
  const existing = db.prepare(`SELECT * FROM sch_calendars WHERE project_id = ? AND is_default = 1`).get(projectId);
  if (existing) return existing;
  const uuid = randomUUID();
  const info = db.prepare(
    `INSERT INTO sch_calendars (uuid, project_id, name, working_days, hours_per_day, is_default) VALUES (@uuid, @project_id, @name, @working_days, 8, 1)`
  ).run({ uuid, project_id: projectId, name: 'التقويم الافتراضي للمشروع', working_days: JSON.stringify(DEFAULT_WORKING_DAYS) });
  const row = db.prepare(`SELECT * FROM sch_calendars WHERE id = ?`).get(info.lastInsertRowid);
  writePmAudit(db, { project_id: projectId, entity_type: 'sch_calendar', entity_id: row.id, action: 'create', after: row, actor });
  return row;
}

export function createCalendar({ project_id, name, working_days, hours_per_day }, actor) {
  const db = sdb();
  const uuid = randomUUID();
  const info = db.prepare(
    `INSERT INTO sch_calendars (uuid, project_id, name, working_days, hours_per_day, is_default)
     VALUES (@uuid, @project_id, @name, @working_days, @hours_per_day, 0)`
  ).run({
    uuid, project_id: project_id ?? null, name,
    working_days: JSON.stringify(working_days && working_days.length ? working_days : DEFAULT_WORKING_DAYS),
    hours_per_day: Number(hours_per_day) || 8,
  });
  const row = db.prepare(`SELECT * FROM sch_calendars WHERE id = ?`).get(info.lastInsertRowid);
  writePmAudit(db, { project_id, entity_type: 'sch_calendar', entity_id: row.id, action: 'create', after: row, actor });
  return row;
}

export function updateCalendar(id, data, actor) {
  const db = sdb();
  const before = db.prepare(`SELECT * FROM sch_calendars WHERE id = ?`).get(id);
  if (!before) throw new Error('التقويم غير موجود.');
  const name = data.name ?? before.name;
  const workingDays = data.working_days ? JSON.stringify(data.working_days) : before.working_days;
  const hoursPerDay = data.hours_per_day != null ? Number(data.hours_per_day) : before.hours_per_day;
  db.prepare(`UPDATE sch_calendars SET name=@name, working_days=@working_days, hours_per_day=@hours_per_day, updated_at=datetime('now') WHERE id=@id`)
    .run({ id, name, working_days: workingDays, hours_per_day: hoursPerDay });
  const after = db.prepare(`SELECT * FROM sch_calendars WHERE id = ?`).get(id);
  writePmAudit(db, { project_id: after.project_id, entity_type: 'sch_calendar', entity_id: id, action: 'update', before, after, actor });
  return after;
}

export function addException(calendarId, { exception_date, is_working = 0, note }, actor) {
  const db = sdb();
  const cal = db.prepare(`SELECT * FROM sch_calendars WHERE id = ?`).get(calendarId);
  if (!cal) throw new Error('التقويم غير موجود.');
  const info = db.prepare(
    `INSERT INTO sch_calendar_exceptions (calendar_id, exception_date, is_working, note)
     VALUES (@calendar_id, @exception_date, @is_working, @note)
     ON CONFLICT(calendar_id, exception_date) DO UPDATE SET is_working=excluded.is_working, note=excluded.note`
  ).run({ calendar_id: calendarId, exception_date, is_working: is_working ? 1 : 0, note: note || null });
  const row = db.prepare(`SELECT * FROM sch_calendar_exceptions WHERE calendar_id = ? AND exception_date = ?`).get(calendarId, exception_date);
  writePmAudit(db, { project_id: cal.project_id, entity_type: 'sch_calendar_exception', entity_id: row.id, action: 'create', after: row, actor });
  return row;
}

export function removeException(id, actor) {
  const db = sdb();
  const row = db.prepare(`SELECT * FROM sch_calendar_exceptions WHERE id = ?`).get(id);
  if (!row) return;
  const cal = db.prepare(`SELECT * FROM sch_calendars WHERE id = ?`).get(row.calendar_id);
  db.prepare(`DELETE FROM sch_calendar_exceptions WHERE id = ?`).run(id);
  writePmAudit(db, { project_id: cal?.project_id, entity_type: 'sch_calendar_exception', entity_id: id, action: 'delete', before: row, actor });
}
