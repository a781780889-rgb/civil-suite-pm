import { NextResponse } from 'next/server';
import { listBaselines, createBaseline } from '@/lib/schedule/db/baselines.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';
import { assertPermission } from '@/lib/pm/roles.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'schedule', 'view');
    return NextResponse.json({ success: true, baselines: listBaselines(Number(id)) });
  } catch (err) {
    return handlePmError(err);
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'schedule', 'edit');
    const baseline = createBaseline(Number(id), body, actor);
    return NextResponse.json({ success: true, baseline });
  } catch (err) {
    return handlePmError(err);
  }
}
