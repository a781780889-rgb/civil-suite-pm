import { NextResponse } from 'next/server';
import { getTask, updateTask, deleteTask, listSubtasks, listDependencies } from '@/lib/pm/db/tasks.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';

export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    const task = getTask(Number(id));
    if (!task) return NextResponse.json({ success: false, error: 'المهمة غير موجودة.' }, { status: 404 });
    return NextResponse.json({
      success: true, task,
      subtasks: listSubtasks(task.id),
      dependencies: listDependencies(task.id),
    });
  } catch (err) {
    return handlePmError(err);
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'task', 'edit');
    const task = updateTask(Number(id), { ...body, actor });
    return NextResponse.json({ success: true, task });
  } catch (err) {
    return handlePmError(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'task', 'delete');
    const result = deleteTask(Number(id), actor);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return handlePmError(err);
  }
}
