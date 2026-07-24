// lib/pm/db/projectStats.js
// =============================================================================
// مُجمِّع علوي يستدعي بقية وحدات db/* لبناء الصورة الكاملة لمشروع واحد (تبويب "نظرة عامة").
// يعيش فوق الجميع في شجرة الاستيراد عمداً (بدل وضعه داخل projects.js) لتفادي أي استيراد
// دائري: budget.js/documents.js وغيرها تستورد من projects.js لجلب المشروع، فلا يصح أن
// يستورد projects.js منها بدوره.
// =============================================================================

import { pdb } from '../schema.js';
import { getProjectById, listProjectStatusHistory } from './projects.js';
import { listPhases } from './phases.js';
import { listTasks } from './tasks.js';
import { listTeamMembers } from './team.js';
import { getBudgetSummaryForProject } from './budget.js';
import { listRisks } from './risks.js';
import { listQualityRecords } from './quality.js';
import { listSafetyRecords } from './safety.js';
import { listDocuments } from './documents.js';
import { countUnread } from './notifications.js';
import { computeProjectProgress } from '../progress.js';
import { findDelayedTasks } from '../criticalPath.js';

export function getProjectStats(projectId) {
  const project = getProjectById(projectId);
  if (!project) return null;

  const phases = listPhases(projectId);
  const tasks = listTasks({ project_id: projectId });
  const team = listTeamMembers(projectId);
  const risks = listRisks({ project_id: projectId });
  const quality = listQualityRecords({ project_id: projectId });
  const safety = listSafetyRecords({ project_id: projectId });
  const documents = listDocuments({ project_id: projectId });
  const budgetSummary = getBudgetSummaryForProject(projectId);
  const delayedTasks = findDelayedTasks(tasks, new Date().toISOString().slice(0, 10));

  const db = pdb();
  const linkedCalculations = db.prepare(`SELECT COUNT(*) AS n FROM calculations WHERE project_id = ?`).get(projectId).n;
  const boqElements = db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(total_cost),0) AS cost FROM boq_elements WHERE project_id = ?`).get(projectId);

  return {
    project,
    progressPct: computeProjectProgress(tasks),
    phasesCount: phases.length,
    tasksTotal: tasks.length,
    tasksByStatus: countBy(tasks, 'status'),
    delayedTasksCount: delayedTasks.length,
    teamCount: team.length,
    activeTeamCount: team.filter((t) => t.is_active).length,
    budgetSummary,
    openRisksCount: risks.filter((r) => r.status === 'open').length,
    highRisksCount: risks.filter((r) => r.status === 'open' && r.severityScore >= 15).length,
    openQualityCount: quality.filter((q) => q.status === 'open').length,
    openSafetyCount: safety.filter((s) => s.status === 'open').length,
    documentsCount: documents.length,
    pendingApprovalDocumentsCount: documents.filter((d) => d.status === 'pending_approval').length,
    unreadNotifications: countUnread(projectId),
    statusHistory: listProjectStatusHistory(projectId),
    integration: { linkedCalculations, boqElementsCount: boqElements.n, boqElementsCost: Math.round(boqElements.cost * 100) / 100 },
  };
}

function countBy(rows, field) {
  const out = {};
  for (const r of rows) {
    const key = r[field] || 'غير محدد';
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}
