// lib/schedule/db/activities.js
import { randomUUID } from 'crypto';
import { sdb } from '../schema.js';
import { writePmAudit } from '../../pm/db/audit.js';

export function listActivities(scheduleId) {
  return sdb().prepare(
    `SELECT * FROM sch_activities WHERE schedule_id = ? ORDER BY COALESCE(parent_id, -1) ASC, sequence ASC, id ASC`
  ).all(scheduleId);
}

export function getActivity(id) {
  return sdb().prepare(`SELECT * FROM sch_activities WHERE id = ?`).get(id);
}

function assertScheduleWritable(db, scheduleId) {
  const schedule = db.prepare(`SELECT * FROM sch_schedules WHERE id = ?`).get(scheduleId);
  if (!schedule) throw new Error('الجدول الزمني غير موجود.');
  if (schedule.is_locked) throw new Error('الجدول الزمني مُقفل - لا يمكن التعديل عليه حالياً.');
  return schedule;
}

export function createActivity(data, actor) {
  if (!data.schedule_id) throw new Error('الجدول الزمني مطلوب.');
  if (!data.name?.trim()) throw new Error('اسم النشاط مطلوب.');
  const db = sdb();
  const schedule = assertScheduleWritable(db, data.schedule_id);

  if (data.parent_id) {
    const parent = db.prepare(`SELECT id FROM sch_activities WHERE id = ? AND schedule_id = ?`).get(data.parent_id, data.schedule_id);
    if (!parent) throw new Error('النشاط الأب غير موجود ضمن هذا الجدول.');
  }

  const maxSeq = db.prepare(
    `SELECT COALESCE(MAX(sequence), -1) AS m FROM sch_activities WHERE schedule_id = @schedule_id AND parent_id IS @parent_id`
  ).get({ schedule_id: data.schedule_id, parent_id: data.parent_id ?? null }).m;

  const activityType = data.activity_type || 'task';
  const uuid = randomUUID();
  const info = db.prepare(`
    INSERT INTO sch_activities (
      uuid, schedule_id, project_id, parent_id, sequence, activity_code, name, description,
      activity_type, status, priority, responsible, calendar_id, duration_days, planned_start,
      actual_start, actual_end, progress_pct, location, notes, created_by
    ) VALUES (
      @uuid, @schedule_id, @project_id, @parent_id, @sequence, @activity_code, @name, @description,
      @activity_type, @status, @priority, @responsible, @calendar_id, @duration_days, @planned_start,
      @actual_start, @actual_end, @progress_pct, @location, @notes, @created_by
    )
  `).run({
    uuid, schedule_id: data.schedule_id, project_id: schedule.project_id, parent_id: data.parent_id ?? null,
    sequence: maxSeq + 1, activity_code: data.activity_code || null, name: data.name.trim(), description: data.description || null,
    activity_type: activityType, status: data.status || 'not_started', priority: data.priority || 'medium',
    responsible: data.responsible || null, calendar_id: data.calendar_id || null,
    duration_days: activityType === 'milestone' ? 0 : (Number(data.duration_days) || 1),
    planned_start: data.planned_start || null, actual_start: data.actual_start || null, actual_end: data.actual_end || null,
    progress_pct: Number(data.progress_pct) || 0, location: data.location || null, notes: data.notes || null, created_by: actor || null,
  });

  recomputeWbsCodes(data.schedule_id);
  const row = db.prepare(`SELECT * FROM sch_activities WHERE id = ?`).get(info.lastInsertRowid);
  writePmAudit(db, { project_id: schedule.project_id, entity_type: 'sch_activity', entity_id: row.id, action: 'create', after: row, actor });
  return row;
}

export function updateActivity(id, data, actor) {
  const db = sdb();
  const before = db.prepare(`SELECT * FROM sch_activities WHERE id = ?`).get(id);
  if (!before) throw new Error('النشاط غير موجود.');
  assertScheduleWritable(db, before.schedule_id);

  if (data.parent_id !== undefined && data.parent_id !== null) {
    if (data.parent_id === id) throw new Error('لا يمكن أن يكون النشاط أباً لنفسه.');
    if (isDescendant(db, id, data.parent_id)) throw new Error('لا يمكن نقل النشاط إلى أحد أبنائه - سيُنشئ حلقة في هيكل WBS.');
  }

  const activityType = data.activity_type || before.activity_type;
  const merged = {
    parent_id: data.parent_id !== undefined ? data.parent_id : before.parent_id,
    activity_code: data.activity_code !== undefined ? data.activity_code : before.activity_code,
    name: data.name?.trim() || before.name,
    description: data.description !== undefined ? data.description : before.description,
    activity_type: activityType,
    status: data.status || before.status,
    priority: data.priority || before.priority,
    responsible: data.responsible !== undefined ? data.responsible : before.responsible,
    calendar_id: data.calendar_id !== undefined ? data.calendar_id : before.calendar_id,
    duration_days: activityType === 'milestone' ? 0 : (data.duration_days != null ? Number(data.duration_days) : before.duration_days),
    planned_start: data.planned_start !== undefined ? data.planned_start : before.planned_start,
    actual_start: data.actual_start !== undefined ? data.actual_start : before.actual_start,
    actual_end: data.actual_end !== undefined ? data.actual_end : before.actual_end,
    progress_pct: data.progress_pct != null ? Math.max(0, Math.min(100, Number(data.progress_pct))) : before.progress_pct,
    location: data.location !== undefined ? data.location : before.location,
    notes: data.notes !== undefined ? data.notes : before.notes,
  };

  db.prepare(`
    UPDATE sch_activities SET parent_id=@parent_id, activity_code=@activity_code, name=@name, description=@description,
      activity_type=@activity_type, status=@status, priority=@priority, responsible=@responsible, calendar_id=@calendar_id,
      duration_days=@duration_days, planned_start=@planned_start, actual_start=@actual_start, actual_end=@actual_end,
      progress_pct=@progress_pct, location=@location, notes=@notes, updated_at=datetime('now')
    WHERE id=@id
  `).run({ ...merged, id });

  if (data.parent_id !== undefined && data.parent_id !== before.parent_id) recomputeWbsCodes(before.schedule_id);

  const after = db.prepare(`SELECT * FROM sch_activities WHERE id = ?`).get(id);
  writePmAudit(db, { project_id: before.project_id, entity_type: 'sch_activity', entity_id: id, action: 'update', before, after, actor });
  return after;
}

/** كتابة نتائج إعادة حساب المسار الحرج (ES/EF/LS/LF/Float/الحرَجية) - داخلية، تُستدعى من lib/schedule/recalc.js فقط، دون سجل تدقيق مستقل لكل نشاط (يُسجَّل حدث إعادة الحساب مرة واحدة على مستوى الجدول). */
export function writeComputedFields(scheduleId, computedRows) {
  const db = sdb();
  const stmt = db.prepare(`
    UPDATE sch_activities SET early_start=@early_start, early_finish=@early_finish, late_start=@late_start, late_finish=@late_finish,
      total_float_days=@total_float_days, free_float_days=@free_float_days, is_critical=@is_critical,
      planned_start = COALESCE(planned_start, @early_start), planned_end = @planned_end
    WHERE id=@id AND schedule_id=@schedule_id
  `);
  const tx = db.transaction((rows) => {
    for (const r of rows) {
      stmt.run({
        id: r.id, schedule_id: scheduleId,
        early_start: r.earlyStart, early_finish: r.earlyFinish, late_start: r.lateStart, late_finish: r.lateFinish,
        total_float_days: r.totalFloatDays, free_float_days: r.freeFloatDays, is_critical: r.isCritical ? 1 : 0,
        planned_end: r.earlyFinishInclusive ?? r.earlyFinish,
      });
    }
  });
  tx(computedRows);
}

export function deleteActivity(id, actor) {
  const db = sdb();
  const before = db.prepare(`SELECT * FROM sch_activities WHERE id = ?`).get(id);
  if (!before) return;
  assertScheduleWritable(db, before.schedule_id);
  db.prepare(`DELETE FROM sch_activities WHERE id = ?`).run(id); // CASCADE: يحذف الأبناء + العلاقات + تعيينات الموارد المرتبطة تلقائياً
  recomputeWbsCodes(before.schedule_id);
  writePmAudit(db, { project_id: before.project_id, entity_type: 'sch_activity', entity_id: id, action: 'delete', before, actor });
}

export function reorderActivities(scheduleId, items, actor) {
  const db = sdb();
  const schedule = assertScheduleWritable(db, scheduleId);
  const stmt = db.prepare(`UPDATE sch_activities SET parent_id=@parent_id, sequence=@sequence, updated_at=datetime('now') WHERE id=@id AND schedule_id=@schedule_id`);
  const tx = db.transaction((rows) => {
    for (const r of rows) stmt.run({ id: r.id, parent_id: r.parent_id ?? null, sequence: r.sequence, schedule_id: scheduleId });
  });
  tx(items);
  recomputeWbsCodes(scheduleId);
  writePmAudit(db, { project_id: schedule.project_id, entity_type: 'schedule', entity_id: scheduleId, action: 'reorder_activities', after: { movedCount: items.length }, actor });
  return listActivities(scheduleId);
}

/** يعيد ترقيم WBS تلقائياً (1، 1.1، 1.2، 2...) بترتيب الإخوة (sequence) من الجذر نزولاً. */
export function recomputeWbsCodes(scheduleId) {
  const db = sdb();
  const rows = db.prepare(`SELECT id, parent_id, sequence FROM sch_activities WHERE schedule_id = ?`).all(scheduleId);
  const childrenOf = new Map();
  for (const r of rows) {
    const key = r.parent_id ?? 'root';
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key).push(r);
  }
  const updates = [];
  function walk(parentKey, prefix) {
    const kids = (childrenOf.get(parentKey) || []).sort((a, b) => a.sequence - b.sequence);
    kids.forEach((kid, idx) => {
      const code = prefix ? `${prefix}.${idx + 1}` : `${idx + 1}`;
      updates.push({ id: kid.id, wbs_code: code });
      walk(kid.id, code);
    });
  }
  walk('root', '');
  const stmt = db.prepare(`UPDATE sch_activities SET wbs_code = @wbs_code WHERE id = @id`);
  const tx = db.transaction((items) => { for (const it of items) stmt.run(it); });
  tx(updates);
}

function isDescendant(db, ancestorId, candidateId) {
  let cur = db.prepare(`SELECT parent_id FROM sch_activities WHERE id = ?`).get(candidateId);
  let guard = 0;
  while (cur?.parent_id != null && guard < 500) {
    if (cur.parent_id === ancestorId) return true;
    cur = db.prepare(`SELECT parent_id FROM sch_activities WHERE id = ?`).get(cur.parent_id);
    guard += 1;
  }
  return false;
}
