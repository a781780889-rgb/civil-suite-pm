import { NextResponse } from 'next/server';
import { listCorrectiveActions, createCorrectiveAction } from '@/lib/hse/db/correctiveActions.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError, pageParams } from '@/lib/hse/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_corrective_action', 'view');
    const data = listCorrectiveActions({
      project_id: searchParams.get('project_id') || undefined, source_type: searchParams.get('source_type') || undefined,
      source_id: searchParams.get('source_id') || undefined, status: searchParams.get('status') || undefined, ...pageParams(searchParams),
    });
    return NextResponse.json({ success: true, ...data });
  } catch (err) {
    return handleHseError(err);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'hse_corrective_action', 'create');
    const action = createCorrectiveAction(body, actor);
    return NextResponse.json({ success: true, action }, { status: 201 });
  } catch (err) {
    return handleHseError(err);
  }
}
