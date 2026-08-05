import { NextResponse } from 'next/server';
import { updateSchedule, deactivateSchedule } from '@/lib/equipment/db/maintenance.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleEquipError } from '@/lib/equipment/apiHelpers.js';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'equipment_maintenance', 'edit');
    const schedule = updateSchedule(id, body, actor);
    return NextResponse.json({ success: true, schedule });
  } catch (err) {
    return handleEquipError(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const { actor, actor_role } = getActor(null, request);
    assertPermission(actor_role, 'equipment_maintenance', 'delete');
    const result = deactivateSchedule(id, actor);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return handleEquipError(err);
  }
}
