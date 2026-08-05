import { NextResponse } from 'next/server';
import { listFuelLogs, createFuelLog } from '@/lib/equipment/db/fuel.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleEquipError } from '@/lib/equipment/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'equipment_operation', 'view');
    const data = listFuelLogs({
      equipment_id: searchParams.get('equipment_id') || undefined, project_id: searchParams.get('project_id') || undefined,
      from: searchParams.get('from') || undefined, to: searchParams.get('to') || undefined,
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
    assertPermission(actor_role, 'equipment_operation', 'create');
    const log = createFuelLog(body, actor);
    return NextResponse.json({ success: true, log }, { status: 201 });
  } catch (err) {
    return handleEquipError(err);
  }
}
