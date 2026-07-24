import { NextResponse } from 'next/server';
import { listAssignments, createAssignment } from '@/lib/pm/db/resources.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const assignments = listAssignments({
      project_id: searchParams.get('project_id') ? Number(searchParams.get('project_id')) : undefined,
      resource_id: searchParams.get('resource_id') ? Number(searchParams.get('resource_id')) : undefined,
      resource_type: searchParams.get('resource_type') || undefined,
    });
    return NextResponse.json({ success: true, assignments });
  } catch (err) {
    return handlePmError(err);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'resource', 'create');
    if (!body.resource_id || !body.project_id) return NextResponse.json({ success: false, error: 'resource_id وproject_id مطلوبان.' }, { status: 400 });
    const assignment = createAssignment({ ...body, actor });
    return NextResponse.json({ success: true, assignment }, { status: 201 });
  } catch (err) {
    return handlePmError(err);
  }
}
