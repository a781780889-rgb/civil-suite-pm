import { NextResponse } from 'next/server';
import { compareBaseline, deleteBaseline } from '@/lib/schedule/db/baselines.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';
import { assertPermission } from '@/lib/pm/roles.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'schedule', 'view');
    const data = compareBaseline(Number(id));
    return NextResponse.json({ success: true, ...data });
  } catch (err) {
    return handlePmError(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const { actor, actor_role } = getActor({}, request);
    assertPermission(actor_role, 'schedule', 'delete');
    deleteBaseline(Number(id), actor);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handlePmError(err);
  }
}
