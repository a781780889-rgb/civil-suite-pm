import { NextResponse } from 'next/server';
import { listMaintenanceRecords, createMaintenanceRecord } from '@/lib/equipment/db/maintenance.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleEquipError } from '@/lib/equipment/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'equipment_maintenance', 'view');
    const data = listMaintenanceRecords({
      equipment_id: searchParams.get('equipment_id') || undefined, maintenance_type: searchParams.get('maintenance_type') || undefined,
      status: searchParams.get('status') || undefined, from: searchParams.get('from') || undefined, to: searchParams.get('to') || undefined,
      page: searchParams.get('page') || undefined, pageSize: searchParams.get('pageSize') || undefined,
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
    assertPermission(actor_role, 'equipment_maintenance', 'create');
    const record = createMaintenanceRecord(body, actor);
    return NextResponse.json({ success: true, record }, { status: 201 });
  } catch (err) {
    return handleEquipError(err);
  }
}
