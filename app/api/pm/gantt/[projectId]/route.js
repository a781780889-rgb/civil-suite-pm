import { NextResponse } from 'next/server';
import { listTasks, listAllDependenciesForProject } from '@/lib/pm/db/tasks.js';
import { getProjectById } from '@/lib/pm/db/projects.js';
import { computeCriticalPath, findDelayedTasks } from '@/lib/pm/criticalPath.js';
import { handlePmError } from '@/lib/pm/apiHelpers.js';

export async function GET(_request, { params }) {
  try {
    const { projectId } = await params;
    const project = getProjectById(Number(projectId));
    if (!project) return NextResponse.json({ success: false, error: 'المشروع غير موجود.' }, { status: 404 });
    const tasks = listTasks({ project_id: Number(projectId) });
    const dependencies = listAllDependenciesForProject(Number(projectId));
    const schedule = computeCriticalPath({ tasks, dependencies, projectStartDate: project.start_date || new Date().toISOString().slice(0, 10) });
    const delayed = findDelayedTasks(tasks, new Date().toISOString().slice(0, 10));
    return NextResponse.json({ success: true, ...schedule, tasks, dependencies, delayedTasks: delayed });
  } catch (err) {
    return handlePmError(err);
  }
}
