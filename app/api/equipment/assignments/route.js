import { NextResponse } from 'next/server';
import { listAssignments, createAssignment } from '@/lib/equipment/db/assignments.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleEquipError } from '@/lib/equipment/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'equipment_operation', 'view');
    const data = listAssignments({
      equipment_id: searchParams.get('equipment_id') || undefined, project_id: searchParams.get('project_id') || undefined,
      status: searchParams.get('status') || undefined, page: searchParams.get('page') || undefined, pageSize: searchParams.get('pageSize') || undefined,
    });
    return NextResponse.json({ success: true, ...data });
  } catch (err) {
    return handleEquipError(err);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'equipment_operation', 'create');
    const assignment = createAssignment(body, actor);
    return NextResponse.json({ success: true, assignment }, { status: 201 });
  } catch (err) {
    return handleEquipError(err);
  }
}
