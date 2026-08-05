import { NextResponse } from 'next/server';
import { confirmReservation, completeReservation, cancelReservation } from '@/lib/equipment/db/reservations.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleEquipError } from '@/lib/equipment/apiHelpers.js';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'equipment_operation', 'edit');
    let reservation;
    if (body.action === 'confirm') reservation = confirmReservation(id, actor);
    else if (body.action === 'complete') reservation = completeReservation(id, actor);
    else reservation = cancelReservation(id, actor);
    return NextResponse.json({ success: true, reservation });
  } catch (err) {
    return handleEquipError(err);
  }
}
