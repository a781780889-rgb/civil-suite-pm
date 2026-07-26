// lib/schedule/db/baselines.js
import { randomUUID } from 'crypto';
import { sdb } from '../schema.js';
import { writePmAudit } from '../../pm/db/audit.js';
import { listActivities } from './activities.js';

export function listBaselines(scheduleId) {
  return sdb().prepare(`SELECT * FROM sch_baselines WHERE schedule_id = ? ORDER BY created_at DESC`).all(scheduleId);
}

export function getBaseline(id) {
  return sdb().prepare(`SELECT * FROM sch_baselines WHERE id = ?`).get(id);
}

export function getBaselineActivities(baselineId) {
  return sdb().prepare(`SELECT * FROM sch_baseline_activities WHERE baseline_id = ? ORDER BY wbs_code ASC`).all(baselineId);
}

export function createBaseline(scheduleId, { name, notes } = {}, actor) {
  const db = sdb();
  const schedule = db.prepare(`SELECT * FROM sch_schedules WHERE id = ?`).get(scheduleId);
  if (!schedule) throw new Error('الجدول الزمني غير موجود.');
  const activities = listActivities(scheduleId);
  const uuid = randomUUID();
  const defaultName = `خط أساس ${new Date().toISOString().slice(0, 10)}`;

  const baselineId = db.transaction(() => {
    const info = db.prepare(`INSERT INTO sch_baselines (uuid, schedule_id, name, notes, created_by) VALUES (@uuid, @schedule_id, @name, @notes, @created_by)`)
      .run({ uuid, schedule_id: scheduleId, name: name?.trim() || defaultName, notes: notes || null, created_by: actor || null });
    const bId = info.lastInsertRowid;
    const stmt = db.prepare(`
      INSERT INTO sch_baseline_activities (baseline_id, activity_id, wbs_code, name, planned_start, planned_end, duration_days, progress_pct)
      VALUES (@baseline_id, @activity_id, @wbs_code, @name, @planned_start, @planned_end, @duration_days, @progress_pct)
    `);
    for (const a of activities) {
      stmt.run({
        baseline_id: bId, activity_id: a.id, wbs_code: a.wbs_code, name: a.name,
        planned_start: a.planned_start, planned_end: a.planned_end, duration_days: a.duration_days, progress_pct: a.progress_pct,
      });
    }
    return bId;
  })();

  const row = db.prepare(`SELECT * FROM sch_baselines WHERE id = ?`).get(baselineId);
  writePmAudit(db, { project_id: schedule.project_id, entity_type: 'sch_baseline', entity_id: baselineId, action: 'create', after: { name: row.name, activityCount: activities.length }, actor });
  return row;
}

export function compareBaseline(baselineId) {
  const db = sdb();
  const baseline = getBaseline(baselineId);
  if (!baseline) throw new Error('خط الأساس غير موجود.');
  const baselineActivities = getBaselineActivities(baselineId);
  const currentActivities = listActivities(baseline.schedule_id);
  const currentById = new Map(currentActivities.map((a) => [a.id, a]));

  const comparison = baselineActivities.map((b) => {
    const current = currentById.get(b.activity_id);
    if (!current) {
      return {
        activity_id: b.activity_id, wbs_code: b.wbs_code, name: b.name, status: 'deleted',
        baseline_start: b.planned_start, baseline_end: b.planned_end, baseline_duration: b.duration_days, baseline_progress: b.progress_pct,
        current_start: null, current_end: null, current_duration: null, current_progress: null, variance_days: null,
      };
    }
    const varianceDays = (b.planned_end && current.planned_end) ? diffDays(b.planned_end, current.planned_end) : null;
    return {
      activity_id: b.activity_id, wbs_code: current.wbs_code || b.wbs_code, name: current.name, status: current.status,
      baseline_start: b.planned_start, baseline_end: b.planned_end, baseline_duration: b.duration_days, baseline_progress: b.progress_pct,
      current_start: current.planned_start, current_end: current.planned_end, current_duration: current.duration_days, current_progress: current.progress_pct,
      variance_days: varianceDays,
    };
  });

  const newActivityIds = currentActivities.filter((a) => !baselineActivities.some((b) => b.activity_id === a.id)).map((a) => a.id);
  return { baseline, comparison, newActivityIds };
}

export function deleteBaseline(id, actor) {
  const db = sdb();
  const before = db.prepare(`SELECT * FROM sch_baselines WHERE id = ?`).get(id);
  if (!before) return;
  db.prepare(`DELETE FROM sch_baselines WHERE id = ?`).run(id);
  writePmAudit(db, { project_id: null, entity_type: 'sch_baseline', entity_id: id, action: 'delete', before, actor });
}

function diffDays(a, b) {
  return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
}
