// lib/pm/db/dashboard.js
import { pdb } from '../schema.js';
import { computeProjectProgress } from '../progress.js';
import { computeBudgetSummary, computeCashFlowByMonth } from '../budgetCalc.js';
import { listPmAuditLog } from './audit.js';
import { listRecentReports } from './reports.js';

/**
 * لوحة تحكم إدارة المشاريع الرئيسية (كل الأرقام محسوبة فعلياً من الصفوف الحية - لا قيم ثابتة).
 * ملاحظة أداء: نسبة الإنجاز الكلية تُحسب بحلقة لكل مشروع نشط لإعادة استخدام نفس صيغة الترجيح
 * الحقيقية (computeProjectProgress) بدل ازدواج المعادلة بلغة SQL؛ مقبول لحجم شركة مقاولات
 * نموذجي (عشرات-مئات المشاريع)، ويحتاج فهرسة/تخزيناً مؤقتاً إضافياً عند نطاق أكبر بكثير.
 */
export function getPmDashboardStats() {
  const db = pdb();

  const projects = db.prepare(`SELECT * FROM projects WHERE is_archived = 0`).all();
  const today = new Date().toISOString().slice(0, 10);

  const byStatus = { planning: 0, in_progress: 0, stopped: 0, completed: 0, cancelled: 0 };
  let delayedCount = 0;
  let totalBudgets = 0;
  let weightedProgressSum = 0;
  let progressWeightTotal = 0;

  for (const p of projects) {
    if (byStatus[p.status] !== undefined) byStatus[p.status] += 1;
    totalBudgets += Number(p.budget) || 0;
    if (p.end_date && p.end_date < today && !['completed', 'cancelled'].includes(p.status)) delayedCount += 1;

    const tasks = db.prepare(`SELECT duration_days, progress_pct, parent_task_id FROM pm_tasks WHERE project_id = ?`).all(p.id);
    if (tasks.length) {
      const pct = computeProjectProgress(tasks);
      const weight = Number(p.budget) || 1;
      weightedProgressSum += pct * weight;
      progressWeightTotal += weight;
    }
  }
  const overallProgressPct = progressWeightTotal > 0 ? Math.round((weightedProgressSum / progressWeightTotal) * 100) / 100 : 0;

  const allBudgetItems = db.prepare(`SELECT * FROM pm_budget_items`).all();
  const totalExpenses = allBudgetItems.filter((b) => b.item_type === 'expense').reduce((s, b) => s + (Number(b.amount) || 0), 0);
  const totalRevenue = allBudgetItems.filter((b) => b.item_type === 'revenue').reduce((s, b) => s + (Number(b.amount) || 0), 0);

  const taskCounts = db.prepare(`SELECT status, COUNT(*) AS n FROM pm_tasks GROUP BY status`).all();
  const openTasks = taskCounts.filter((t) => t.status !== 'completed').reduce((s, t) => s + t.n, 0);
  const completedTasks = taskCounts.find((t) => t.status === 'completed')?.n || 0;

  const activeUsers = db.prepare(`SELECT COUNT(*) AS n FROM pm_team_members WHERE is_active = 1`).get().n;
  const notificationsCount = db.prepare(`SELECT COUNT(*) AS n FROM pm_notifications WHERE is_read = 0`).get().n;

  return {
    totals: {
      totalProjects: projects.length,
      activeProjects: byStatus.in_progress,
      completedProjects: byStatus.completed,
      stoppedProjects: byStatus.stopped,
      delayedProjects: delayedCount,
      planningProjects: byStatus.planning,
      totalBudgets: round2(totalBudgets),
      totalExpenses: round2(totalExpenses),
      totalRevenue: round2(totalRevenue),
      overallProgressPct,
      openTasks,
      completedTasks,
      notificationsCount,
      activeUsers,
    },
    statusChart: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
    cashFlowByMonth: computeCashFlowByMonth(allBudgetItems),
    projectsTimeline: projects
      .filter((p) => p.start_date || p.end_date)
      .map((p) => ({ id: p.id, name: p.name, status: p.status, start_date: p.start_date, end_date: p.end_date })),
    recentActivity: listPmAuditLog({ limit: 10 }),
    recentReports: listRecentReports({ limit: 8 }),
  };
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}
