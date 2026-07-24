// lib/pm/reportsData.js
// =============================================================================
// يبني الشكل النهائي (جداول + ملخصات) لكل نوع تقرير من التقارير الأربعة عشر المطلوبة، من
// بيانات حقيقية مُمرَّرة إليه فقط (لا اتصال قاعدة بيانات هنا - ذلك في lib/pm/db/*). التقارير
// اليومي/الأسبوعي/الشهري تتشارك بانياً واحداً (buildPeriodActivityReport) بنطاق تاريخ مختلف،
// تطبيقاً لمبدأ DRY بدل تكرار المنطق ثلاث مرات (قاعدة اثنا عشر: "التقارير ديناميكية وليست ثابتة").
// =============================================================================

import { computeBudgetSummary, computeCashFlowByMonth } from './budgetCalc.js';
import { computeProjectProgress, computePhaseProgress } from './progress.js';

export function buildPeriodActivityReport({ project, periodLabel, startDate, endDate, tasks, budgetItems, safetyRecords, qualityRecords, meetings }) {
  const inRange = (dateStr) => dateStr && dateStr >= startDate && dateStr <= endDate;
  return {
    reportType: 'period_activity',
    periodLabel,
    project: pickProject(project),
    range: { startDate, endDate },
    tasksActivity: tasks.filter((t) => inRange(t.updated_at?.slice(0, 10)) || inRange(t.actual_start) || inRange(t.actual_end)),
    budgetActivity: budgetItems.filter((b) => inRange(b.date)),
    safetyActivity: safetyRecords.filter((s) => inRange(s.record_date)),
    qualityActivity: qualityRecords.filter((q) => inRange(q.record_date)),
    meetingsActivity: meetings.filter((m) => inRange(m.meeting_date)),
    totals: {
      tasksUpdated: tasks.filter((t) => inRange(t.updated_at?.slice(0, 10))).length,
      expensesRecorded: budgetItems.filter((b) => b.item_type === 'expense' && inRange(b.date)).reduce((s, b) => s + Number(b.amount || 0), 0),
      safetyEvents: safetyRecords.filter((s) => inRange(s.record_date)).length,
      qualityEvents: qualityRecords.filter((q) => inRange(q.record_date)).length,
    },
  };
}

export function buildProgressReport({ project, phases, tasks }) {
  const projectProgressPct = computeProjectProgress(tasks);
  return {
    reportType: 'progress',
    project: pickProject(project),
    projectProgressPct,
    phases: phases.map((p) => ({
      name: p.name, status: p.status,
      progress_pct: computePhaseProgress(tasks.filter((t) => t.phase_id === p.id)) ?? p.progress_pct,
      planned_start: p.planned_start, planned_end: p.planned_end, actual_start: p.actual_start, actual_end: p.actual_end,
    })),
    tasksByStatus: countBy(tasks, 'status'),
    totalTasks: tasks.length,
  };
}

export function buildFinancialReport({ project, budgetItems }) {
  const summary = computeBudgetSummary(project, budgetItems);
  return {
    reportType: 'financial',
    project: pickProject(project),
    summary,
    cashFlowByMonth: computeCashFlowByMonth(budgetItems),
    items: budgetItems.map((b) => ({ item_type: b.item_type, category: b.category, description: b.description, amount: b.amount, date: b.date, status: b.status })),
  };
}

export function buildResourcesReport({ assignments }) {
  const byType = {};
  for (const a of assignments) {
    const key = a.resource_type || 'other';
    if (!byType[key]) byType[key] = { resource_type: key, count: 0, totalCost: 0 };
    byType[key].count += 1;
    byType[key].totalCost += Number(a.cost) || 0;
  }
  return { reportType: 'resources', byType: Object.values(byType), assignments };
}

export function buildQualityReport({ records }) {
  return { reportType: 'quality', byStatus: countBy(records, 'status'), byType: countBy(records, 'record_type'), records };
}

export function buildSafetyReport({ records }) {
  return { reportType: 'safety', byStatus: countBy(records, 'status'), bySeverity: countBy(records, 'severity'), records };
}

export function buildRiskReport({ risks }) {
  const scored = risks.map((r) => ({ ...r, severityScore: (Number(r.probability) || 0) * (Number(r.impact) || 0) }));
  return {
    reportType: 'risk',
    byStatus: countBy(risks, 'status'),
    highSeverity: scored.filter((r) => r.severityScore >= 15).length,
    risks: scored.sort((a, b) => b.severityScore - a.severityScore),
  };
}

export function buildExecutiveReport({ project, phases, tasks, budgetItems, risks, safetyRecords, qualityRecords, delayedTasks }) {
  return {
    reportType: 'executive',
    project: pickProject(project),
    projectProgressPct: computeProjectProgress(tasks),
    budgetSummary: computeBudgetSummary(project, budgetItems),
    openRisksCount: risks.filter((r) => r.status === 'open').length,
    highSeverityRisksCount: risks.filter((r) => r.status === 'open' && (Number(r.probability) || 0) * (Number(r.impact) || 0) >= 15).length,
    openSafetyCount: safetyRecords.filter((s) => s.status === 'open').length,
    openQualityCount: qualityRecords.filter((q) => q.status === 'open').length,
    delayedTasksCount: delayedTasks.length,
    phasesSummary: phases.map((p) => ({ name: p.name, status: p.status, progress_pct: p.progress_pct })),
  };
}

function pickProject(p) {
  return { id: p.id, name: p.name, project_code: p.project_code, status: p.status, currency: p.currency, start_date: p.start_date, end_date: p.end_date };
}

function countBy(rows, field) {
  const out = {};
  for (const r of rows) {
    const key = r[field] || 'غير محدد';
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}
