import { NextResponse } from 'next/server';
import { deleteCategory } from '@/lib/equipment/db/categories.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleEquipError } from '@/lib/equipment/apiHelpers.js';

export async function DELETE(request, { params }) {
  try {
    const { key } = await params;
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'equipment', 'delete');
    const result = deleteCategory(key);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return handleEquipError(err);
  }
}
