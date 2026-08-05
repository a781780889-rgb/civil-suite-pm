import { NextResponse } from 'next/server';
import { listCategories, createCategory } from '@/lib/equipment/db/categories.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleEquipError } from '@/lib/equipment/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'equipment', 'view');
    const rows = listCategories({ group_key: searchParams.get('group_key') || undefined });
    return NextResponse.json({ success: true, rows });
  } catch (err) {
    return handleEquipError(err);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { actor_role } = getActor(body, request);
    assertPermission(actor_role, 'equipment', 'create');
    const category = createCategory(body);
    return NextResponse.json({ success: true, category }, { status: 201 });
  } catch (err) {
    return handleEquipError(err);
  }
}
