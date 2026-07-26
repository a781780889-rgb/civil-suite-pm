// lib/schedule/db/progress.js
import { sdb } from '../schema.js';
import { writePmAudit } from '../../pm/db/audit.js';

export function listProgressLog(activityId) {
  return sdb().prepare(`SELECT * FROM sch_progress_log WHERE activity_id = ? ORDER BY log_date DESC, created_at DESC`).all(activityId);
}

export function logProgress({ activity_id, progress_pct, actual_start, actual_end, delay_reason, note, log_date }, actor) {
  const db = sdb();
  const activity = db.prepare(`SELECT * FROM sch_activities WHERE id = ?`).get(activity_id);
  if (!activity) throw new Error('النشاط غير موجود.');
  const pct = Math.max(0, Math.min(100, Number(progress_pct)));
  const today = new Date().toISOString().slice(0, 10);

  db.transaction(() => {
    db.prepare(`
      INSERT INTO sch_progress_log (activity_id, schedule_id, log_date, progress_pct, actual_start, actual_end, delay_reason, note, actor)
      VALUES (@activity_id, @schedule_id, @log_date, @progress_pct, @actual_start, @actual_end, @delay_reason, @note, @actor)
    `).run({
      activity_id, schedule_id: activity.schedule_id, log_date: log_date || today, progress_pct: pct,
      actual_start: actual_start || null, actual_end: actual_end || null, delay_reason: delay_reason || null,
      note: note || null, actor: actor || null,
    });

    const status = pct >= 100 ? 'completed' : (pct > 0 && activity.status === 'not_started' ? 'in_progress' : activity.status);
    db.prepare(`
      UPDATE sch_activities SET progress_pct=@pct, status=@status,
        actual_start = COALESCE(actual_start, @actual_start), actual_end = @actual_end, updated_at = datetime('now')
      WHERE id = @id
    `).run({
      pct, status, id: activity_id,
      actual_start: actual_start || null,
      actual_end: pct >= 100 ? (actual_end || today) : (actual_end || activity.actual_end || null),
    });
  })();

  const after = db.prepare(`SELECT * FROM sch_activities WHERE id = ?`).get(activity_id);
  writePmAudit(db, {
    project_id: activity.project_id, entity_type: 'sch_activity', entity_id: activity_id, action: 'progress_update',
    before: { progress_pct: activity.progress_pct, status: activity.status },
    after: { progress_pct: after.progress_pct, status: after.status, delay_reason: delay_reason || null },
    actor,
  });
  return after;
}

/** مقارنة المخطط بالفعلي لكل أنشطة جدول: الفرق بالأيام، أنشطة متأخرة/متقدمة. */
export function comparePlannedVsActual(scheduleId) {
  const db = sdb();
  const activities = db.prepare(`SELECT * FROM sch_activities WHERE schedule_id = ? AND activity_type != 'summary' ORDER BY wbs_code ASC`).all(scheduleId);
  return activities.map((a) => {
    const referenceEnd = a.actual_end || a.planned_end || a.early_finish;
    const varianceDays = (a.planned_end && referenceEnd) ? diffDays(a.planned_end, referenceEnd) : null;
    return {
      id: a.id, wbs_code: a.wbs_code, name: a.name, status: a.status,
      planned_start: a.planned_start, planned_end: a.planned_end,
      actual_start: a.actual_start, actual_end: a.actual_end,
      progress_pct: a.progress_pct, is_critical: !!a.is_critical,
      variance_days: varianceDays,
      is_ahead: varianceDays != null && varianceDays < 0,
      is_delayed: varianceDays != null && varianceDays > 0,
    };
  });
}

function diffDays(a, b) {
  return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
}
