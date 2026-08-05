import { NextResponse } from 'next/server';
import { listEquipment, createEquipment } from '@/lib/equipment/db/equipment.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleEquipError } from '@/lib/equipment/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'equipment', 'view');
    const data = listEquipment({
      page: searchParams.get('page') || undefined, pageSize: searchParams.get('pageSize') || undefined,
      status: searchParams.get('status') || undefined, category_key: searchParams.get('category_key') || undefined,
      group_key: searchParams.get('group_key') || undefined, project_id: searchParams.get('project_id') || undefined,
      ownership_type: searchParams.get('ownership_type') || undefined, search: searchParams.get('search') || undefined,
      includeArchived: searchParams.get('includeArchived') === 'true',
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
    assertPermission(actor_role, 'equipment', 'create');
    const equipment = createEquipment(body, actor);
    return NextResponse.json({ success: true, equipment }, { status: 201 });
  } catch (err) {
    return handleEquipError(err);
  }
}
