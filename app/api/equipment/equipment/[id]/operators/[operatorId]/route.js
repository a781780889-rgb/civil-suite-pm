import { NextResponse } from 'next/server';
import { revokeAuthorization } from '@/lib/equipment/db/operators.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleEquipError } from '@/lib/equipment/apiHelpers.js';

export async function DELETE(request, { params }) {
  try {
    const { id, operatorId } = await params;
    const { actor, actor_role } = getActor(null, request);
    assertPermission(actor_role, 'equipment_operator', 'edit');
    const rows = revokeAuthorization(operatorId, id, actor);
    return NextResponse.json({ success: true, rows });
  } catch (err) {
    return handleEquipError(err);
  }
}
