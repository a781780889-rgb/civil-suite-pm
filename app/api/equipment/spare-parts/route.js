import { NextResponse } from 'next/server';
import { listParts, createPart } from '@/lib/equipment/db/spareParts.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleEquipError } from '@/lib/equipment/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'equipment_spare_part', 'view');
    const data = listParts({
      search: searchParams.get('search') || undefined, low_stock_only: searchParams.get('low_stock_only') === 'true',
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
    assertPermission(actor_role, 'equipment_spare_part', 'create');
    const part = createPart(body, actor);
    return NextResponse.json({ success: true, part }, { status: 201 });
  } catch (err) {
    return handleEquipError(err);
  }
}
