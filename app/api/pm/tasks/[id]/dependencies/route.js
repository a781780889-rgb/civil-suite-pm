import { NextResponse } from 'next/server';
import { listDependencies, addDependency } from '@/lib/pm/db/tasks.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';

export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    return NextResponse.json({ success: true, dependencies: listDependencies(Number(id)) });
  } catch (err) {
    return handlePmError(err);
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'task', 'edit');
    if (!body.depends_on_task_id) return NextResponse.json({ success: false, error: 'depends_on_task_id مطلوب.' }, { status: 400 });
    const dep = addDependency({ task_id: Number(id), depends_on_task_id: Number(body.depends_on_task_id), dep_type: body.dep_type, lag_days: body.lag_days }, actor);
    return NextResponse.json({ success: true, dependency: dep }, { status: 201 });
  } catch (err) {
    return handlePmError(err);
  }
}
