import { NextResponse } from 'next/server';
import { getProjectById } from '@/lib/pm/db/projects.js';
import { listPhases } from '@/lib/pm/db/phases.js';
import { listTasks } from '@/lib/pm/db/tasks.js';
import { getBudgetSummaryForProject } from '@/lib/pm/db/budget.js';
import { listRisks } from '@/lib/pm/db/risks.js';
import { findDelayedTasks } from '@/lib/pm/criticalPath.js';
import { analyzeProjectHealth } from '@/lib/pm/ai.js';
import { handlePmError } from '@/lib/pm/apiHelpers.js';

export async function POST(request) {
  try {
    const body = await request.json();
    if (!body.project_id) return NextResponse.json({ success: false, error: 'project_id مطلوب.' }, { status: 400 });
    const project = getProjectById(Number(body.project_id));
    if (!project) return NextResponse.json({ success: false, error: 'المشروع غير موجود.' }, { status: 404 });
    const tasks = listTasks({ project_id: project.id });
    const analysis = await analyzeProjectHealth({
      project, phases: listPhases(project.id), tasks,
      delayedTasks: findDelayedTasks(tasks, new Date().toISOString().slice(0, 10)),
      budgetSummary: getBudgetSummaryForProject(project.id),
      risks: listRisks({ project_id: project.id }),
    });
    return NextResponse.json({ success: true, analysis });
  } catch (err) {
    return handlePmError(err);
  }
}
