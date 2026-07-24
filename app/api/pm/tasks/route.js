import { NextResponse } from 'next/server';
import { listTasks, createTask } from '@/lib/pm/db/tasks.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handlePmError, pageParams } from '@/lib/pm/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize } = pageParams(searchParams);
    const result = listTasks({
      project_id: searchParams.get('project_id') ? Number(searchParams.get('project_id')) : undefined,
      phase_id: searchParams.get('phase_id') ? Number(searchParams.get('phase_id')) : undefined,
      parent_task_id: searchParams.get('parent_task_id') || undefined,
      assignee_id: searchParams.get('assignee_id') ? Number(searchParams.get('assignee_id')) : undefined,
      status: searchParams.get('status') || undefined,
      priority: searchParams.get('priority') || undefined,
      search: searchParams.get('search') || undefined,
      page, pageSize,
    });
    return NextResponse.json({ success: true, ...(Array.isArray(result) ? { tasks: result } : { tasks: result.rows, total: result.total, page: result.page, pageSize: result.pageSize, totalPages: result.totalPages }) });
  } catch (err) {
    return handlePmError(err);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'task', 'create');
    if (!body.project_id || !body.title) return NextResponse.json({ success: false, error: 'project_id وعنوان المهمة مطلوبان.' }, { status: 400 });
    const task = createTask({ ...body, actor });
    return NextResponse.json({ success: true, task }, { status: 201 });
  } catch (err) {
    return handlePmError(err);
  }
}
