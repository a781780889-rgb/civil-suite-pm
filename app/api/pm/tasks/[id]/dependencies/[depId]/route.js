import { NextResponse } from 'next/server';
import { removeDependency } from '@/lib/pm/db/tasks.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';

export async function DELETE(request, { params }) {
  try {
    const { depId } = await params;
    const body = await request.json().catch(() => ({}));
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'task', 'edit');
    const result = removeDependency(Number(depId), actor);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return handlePmError(err);
  }
}
