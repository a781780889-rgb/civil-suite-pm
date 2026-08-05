import { NextResponse } from 'next/server';
import { getMaintenanceRecordById, completeMaintenanceRecord } from '@/lib/equipment/db/maintenance.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleEquipError } from '@/lib/equipment/apiHelpers.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'equipment_maintenance', 'view');
    const record = getMaintenanceRecordById(id);
    if (!record) return NextResponse.json({ success: false, error: 'سجل الصيانة غير موجود.' }, { status: 404 });
    return NextResponse.json({ success: true, record });
  } catch (err) {
    return handleEquipError(err);
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'equipment_maintenance', 'edit');
    const record = completeMaintenanceRecord(id, body, actor);
    return NextResponse.json({ success: true, record });
  } catch (err) {
    return handleEquipError(err);
  }
}
