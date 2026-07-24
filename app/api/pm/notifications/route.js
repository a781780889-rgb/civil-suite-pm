import { NextResponse } from 'next/server';
import { listNotifications, markAllRead, upsertNotification } from '@/lib/pm/db/notifications.js';
import { listProjectsPaged, getProjectById } from '@/lib/pm/db/projects.js';
import { listTasks } from '@/lib/pm/db/tasks.js';
import { getBudgetSummaryForProject } from '@/lib/pm/db/budget.js';
import { findDelayedTasks } from '@/lib/pm/criticalPath.js';
import { buildTaskDelayNotifications, buildBudgetNotification, buildContractExpiryNotification } from '@/lib/pm/notifications.js';
import { handlePmError } from '@/lib/pm/apiHelpers.js';

/** يمسح مشروعاً واحداً بحثاً عن تنبيهات زمنية حقيقية (تأخير مهام / اقتراب تسليم) ويُخزّنها مع تفادي التكرار. */
function sweepProject(projectId, todayStr) {
  const project = getProjectById(projectId);
  if (!project) return;
  const tasks = listTasks({ project_id: projectId });
  const delayed = findDelayedTasks(tasks, todayStr);
  for (const n of buildTaskDelayNotifications(delayed)) upsertNotification({ ...n, project_id: projectId });

  const budgetSummary = getBudgetSummaryForProject(projectId);
  const budgetNotif = buildBudgetNotification(project, budgetSummary);
  if (budgetNotif) upsertNotification({ ...budgetNotif, project_id: projectId });

  const expiryNotif = buildContractExpiryNotification(project, todayStr);
  if (expiryNotif) upsertNotification({ ...expiryNotif, project_id: projectId });
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    const today = new Date().toISOString().slice(0, 10);

    if (projectId) {
      sweepProject(Number(projectId), today);
    } else {
      // مسح شامل لكل المشاريع النشطة (غير المؤرشفة) - يُستدعى عند فتح لوحة تنبيهات عامة
      const { rows } = listProjectsPaged({ pageSize: 200 });
      for (const p of rows) sweepProject(p.id, today);
    }

    const notifications = listNotifications({
      project_id: projectId ? Number(projectId) : undefined,
      is_read: searchParams.get('is_read') !== null ? searchParams.get('is_read') === '1' : undefined,
    });
    return NextResponse.json({ success: true, notifications });
  } catch (err) {
    return handlePmError(err);
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    if (!body.project_id) return NextResponse.json({ success: false, error: 'project_id مطلوب.' }, { status: 400 });
    const result = markAllRead(Number(body.project_id));
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return handlePmError(err);
  }
}
