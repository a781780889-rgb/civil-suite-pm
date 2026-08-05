import { NextResponse } from 'next/server';
import { listInspections, createInspection } from '@/lib/equipment/db/inspections.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleEquipError } from '@/lib/equipment/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'safety', 'view');
    const data = listInspections({
      equipment_id: searchParams.get('equipment_id') || undefined, result: searchParams.get('result') || undefined,
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
    assertPermission(actor_role, 'safety', 'create');
    const inspection = createInspection(body, actor);
    return NextResponse.json({ success: true, inspection }, { status: 201 });
  } catch (err) {
    return handleEquipError(err);
  }
}
