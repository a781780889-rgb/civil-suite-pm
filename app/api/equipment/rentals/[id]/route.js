import { NextResponse } from 'next/server';
import { updateRentalStatus } from '@/lib/equipment/db/rentals.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleEquipError } from '@/lib/equipment/apiHelpers.js';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'equipment_rental', 'edit');
    const rental = updateRentalStatus(id, body.contract_status, actor);
    return NextResponse.json({ success: true, rental });
  } catch (err) {
    return handleEquipError(err);
  }
}
