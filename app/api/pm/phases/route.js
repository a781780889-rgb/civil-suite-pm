import { NextResponse } from 'next/server';
import { listPhases, createPhase } from '@/lib/pm/db/phases.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    if (!projectId) return NextResponse.json({ success: false, error: 'project_id مطلوب.' }, { status: 400 });
    return NextResponse.json({ success: true, phases: listPhases(Number(projectId)) });
  } catch (err) {
    return handlePmError(err);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'phase', 'create');
    if (!body.project_id || !body.name) return NextResponse.json({ success: false, error: 'project_id واسم المرحلة مطلوبان.' }, { status: 400 });
    const phase = createPhase({ ...body, actor });
    return NextResponse.json({ success: true, phase }, { status: 201 });
  } catch (err) {
    return handlePmError(err);
  }
}
