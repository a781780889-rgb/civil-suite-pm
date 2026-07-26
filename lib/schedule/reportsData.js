// lib/schedule/reportsData.js
// يبني شكل كل تقرير من بيانات مُمرَّرة فقط (لا اتصال قاعدة بيانات هنا) - نفس مبدأ lib/pm/reportsData.js.
export function buildScheduleSummaryReport({ schedule, activities, computedResult }) {
  const real = activities.filter((a) => a.activity_type !== 'summary');
  return {
    reportType: 'summary', schedule: pickSchedule(schedule),
    totalActivities: real.length, projectEndDate: computedResult?.projectEndDate,
    activities: activities.map((a) => ({
      wbs_code: a.wbs_code, name: a.name, activity_type: a.activity_type, status: a.status,
      planned_start: a.planned_start, planned_end: a.planned_end, duration_days: a.duration_days,
      progress_pct: a.progress_pct, is_critical: !!a.is_critical, total_float_days: a.total_float_days,
    })),
  };
}

export function buildProgressReport({ schedule, activities }) {
  const real = activities.filter((a) => a.activity_type !== 'summary');
  return {
    reportType: 'progress', schedule: pickSchedule(schedule), overallProgressPct: weightedProgress(real),
    byStatus: countBy(real, 'status'),
    activities: real.map((a) => ({ wbs_code: a.wbs_code, name: a.name, status: a.status, progress_pct: a.progress_pct, planned_start: a.planned_start, planned_end: a.planned_end })),
  };
}

export function buildCriticalPathReport({ schedule, activities }) {
  const critical = activities.filter((a) => a.is_critical).sort((a, b) => (a.planned_start || '').localeCompare(b.planned_start || ''));
  return {
    reportType: 'critical_path', schedule: pickSchedule(schedule), criticalCount: critical.length,
    activities: critical.map((a) => ({
      wbs_code: a.wbs_code, name: a.name, planned_start: a.planned_start, planned_end: a.planned_end,
      duration_days: a.duration_days, total_float_days: a.total_float_days, free_float_days: a.free_float_days,
    })),
  };
}

export function buildResourcesReport({ schedule, assignments }) {
  const byType = {};
  for (const a of assignments) {
    const key = a.resource_type || 'other';
    if (!byType[key]) byType[key] = { resource_type: key, count: 0, totalCost: 0, totalHours: 0 };
    byType[key].count += 1;
    byType[key].totalCost += Number(a.planned_cost) || 0;
    byType[key].totalHours += Number(a.planned_hours) || 0;
  }
  return { reportType: 'resources', schedule: pickSchedule(schedule), byType: Object.values(byType), assignments };
}

export function buildDelayReport({ schedule, delayedActivities }) {
  return {
    reportType: 'delay', schedule: pickSchedule(schedule), delayedCount: delayedActivities.length,
    maxDelayDays: delayedActivities.length ? Math.max(...delayedActivities.map((a) => a.delayDays)) : 0,
    activities: delayedActivities.map((a) => ({ wbs_code: a.wbs_code, name: a.name, planned_end: a.planned_end, delayDays: a.delayDays, status: a.status })),
  };
}

export function buildVarianceReport({ schedule, comparison }) {
  return {
    reportType: 'variance', schedule: pickSchedule(schedule),
    delayedCount: comparison.filter((c) => c.is_delayed).length, aheadCount: comparison.filter((c) => c.is_ahead).length,
    activities: comparison,
  };
}

export function buildExecutiveReport({ schedule, activities, delayedActivities, computedResult, resourceConflictsCount }) {
  const real = activities.filter((a) => a.activity_type !== 'summary');
  return {
    reportType: 'executive', schedule: pickSchedule(schedule),
    totalActivities: real.length, overallProgressPct: weightedProgress(real),
    criticalCount: real.filter((a) => a.is_critical).length, delayedCount: delayedActivities.length,
    projectEndDate: computedResult?.projectEndDate, resourceConflictsCount: resourceConflictsCount || 0,
  };
}

function weightedProgress(rows) {
  const weight = rows.reduce((s, a) => s + Math.max(0.01, a.duration_days || 1), 0);
  if (!weight) return 0;
  return Math.round((rows.reduce((s, a) => s + (Number(a.progress_pct) || 0) * Math.max(0.01, a.duration_days || 1), 0) / weight) * 10) / 10;
}
function pickSchedule(s) {
  return { id: s.id, name: s.name, project_name: s.project_name, status: s.status, data_date: s.data_date };
}
function countBy(rows, field) {
  const out = {};
  for (const r of rows) { const k = r[field] || 'غير محدد'; out[k] = (out[k] || 0) + 1; }
  return out;
}
