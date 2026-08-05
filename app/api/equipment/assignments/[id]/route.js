import { NextResponse } from 'next/server';
import { completeAssignment, cancelAssignment } from '@/lib/equipment/db/assignments.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleEquipError } from '@/lib/equipment/apiHelpers.js';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'equipment_operation', 'edit');
    const assignment = body.action === 'cancel' ? cancelAssignment(id, actor) : completeAssignment(id, actor, body.end_date);
    return NextResponse.json({ success: true, assignment });
  } catch (err) {
    return handleEquipError(err);
  }
}
