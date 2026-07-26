// lib/schedule/db/dashboard.js
import { sdb } from '../schema.js';
import { findDelayedActivities } from '../criticalPath.js';
import { todayStr } from '../calendar.js';

export function getScheduleDashboardStats() {
  const db = sdb();
  const totalSchedules = db.prepare(`SELECT COUNT(*) c FROM sch_schedules WHERE status != 'archived'`).get().c;
  const totalProjectsWithSchedules = db.prepare(`SELECT COUNT(DISTINCT project_id) c FROM sch_schedules WHERE status != 'archived'`).get().c;

  const activities = db.prepare(`
    SELECT a.* FROM sch_activities a
    JOIN sch_schedules s ON s.id = a.schedule_id
    WHERE s.status != 'archived' AND a.activity_type != 'summary'
  `).all();

  const totalActivities = activities.length;
  const completed = activities.filter((a) => a.status === 'completed').length;
  const inProgress = activities.filter((a) => a.status === 'in_progress').length;
  const notStarted = activities.filter((a) => a.status === 'not_started').length;
  const critical = activities.filter((a) => a.is_critical).length;
  const delayed = findDelayedActivities(activities, todayStr());

  const weight = activities.reduce((s, a) => s + Math.max(0.01, a.duration_days || 1), 0);
  const overallProgressPct = totalActivities
    ? Math.round((activities.reduce((s, a) => s + (Number(a.progress_pct) || 0) * Math.max(0.01, a.duration_days || 1), 0) / weight) * 10) / 10
    : 0;

  const today = todayStr();
  const openEnds = activities.filter((a) => a.status !== 'completed' && a.planned_end).map((a) => diffDays(today, a.planned_end));
  const daysRemaining = openEnds.length ? Math.max(0, ...openEnds) : 0;

  const criticalPathActivities = activities
    .filter((a) => a.is_critical)
    .sort((a, b) => (a.planned_start || '').localeCompare(b.planned_start || ''))
    .slice(0, 30);

  const byStatus = countBy(activities, 'status');

  const recentUpdates = db.prepare(`
    SELECT al.*, p.name AS project_name FROM pm_audit_log al
    LEFT JOIN projects p ON p.id = al.project_id
    WHERE al.entity_type IN ('schedule','sch_activity','sch_relationship','sch_baseline','sch_activity_resource')
    ORDER BY al.created_at DESC LIMIT 15
  `).all();

  return {
    totalSchedules, totalProjectsWithSchedules, totalActivities, completed, inProgress, notStarted,
    delayedCount: delayed.length, criticalCount: critical, overallProgressPct, daysRemaining,
    maxDelayDays: delayed.length ? Math.max(...delayed.map((d) => d.delayDays)) : 0,
    criticalPathActivities,
    recentUpdates,
    charts: {
      statusDistribution: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
      summary: [
        { label: 'مكتملة', value: completed },
        { label: 'جارية', value: inProgress },
        { label: 'متأخرة', value: delayed.length },
        { label: 'لم تبدأ', value: notStarted },
      ],
    },
  };
}

function diffDays(a, b) {
  return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
}
function countBy(rows, field) {
  const out = {};
  for (const r of rows) {
    const key = r[field] || 'غير محدد';
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}
