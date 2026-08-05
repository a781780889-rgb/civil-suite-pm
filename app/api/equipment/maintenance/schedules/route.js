import { NextResponse } from 'next/server';
import { listSchedules, createSchedule } from '@/lib/equipment/db/maintenance.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleEquipError } from '@/lib/equipment/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'equipment_maintenance', 'view');
    const rows = listSchedules({
      equipment_id: searchParams.get('equipment_id') || undefined, category_key: searchParams.get('category_key') || undefined,
      is_active: searchParams.has('is_active') ? searchParams.get('is_active') === 'true' : true,
    });
    return NextResponse.json({ success: true, rows });
  } catch (err) {
    return handleEquipError(err);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'equipment_maintenance', 'create');
    const schedule = createSchedule(body, actor);
    return NextResponse.json({ success: true, schedule }, { status: 201 });
  } catch (err) {
    return handleEquipError(err);
  }
}
