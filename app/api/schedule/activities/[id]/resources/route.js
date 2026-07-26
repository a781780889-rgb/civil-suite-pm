import { NextResponse } from 'next/server';
import { listResourcesForActivity, assignResource, findResourceConflicts } from '@/lib/schedule/db/resources.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';
import { assertPermission } from '@/lib/pm/roles.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'schedule', 'view');
    return NextResponse.json({ success: true, assignments: listResourcesForActivity(Number(id)) });
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
    const assignment = assignResource({ ...body, activity_id: Number(id) }, actor);
    const conflicts = findResourceConflicts(assignment.resource_id);
    return NextResponse.json({ success: true, assignment, conflicts });
  } catch (err) {
    return handlePmError(err);
  }
}
