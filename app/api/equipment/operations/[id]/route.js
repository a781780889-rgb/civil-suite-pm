import { NextResponse } from 'next/server';
import { updateOperationLogNotes } from '@/lib/equipment/db/operations.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleEquipError } from '@/lib/equipment/apiHelpers.js';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'equipment_operation', 'edit');
    const log = updateOperationLogNotes(id, body, actor);
    return NextResponse.json({ success: true, log });
  } catch (err) {
    return handleEquipError(err);
  }
}
