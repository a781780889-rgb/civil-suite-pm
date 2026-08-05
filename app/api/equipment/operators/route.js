import { NextResponse } from 'next/server';
import { listOperators, createOperator } from '@/lib/equipment/db/operators.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleEquipError } from '@/lib/equipment/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'equipment_operator', 'view');
    const data = listOperators({
      search: searchParams.get('search') || undefined, category_key: searchParams.get('category_key') || undefined,
      is_active: searchParams.has('is_active') ? searchParams.get('is_active') === 'true' : undefined,
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
    assertPermission(actor_role, 'equipment_operator', 'create');
    const operator = createOperator(body, actor);
    return NextResponse.json({ success: true, operator }, { status: 201 });
  } catch (err) {
    return handleEquipError(err);
  }
}
