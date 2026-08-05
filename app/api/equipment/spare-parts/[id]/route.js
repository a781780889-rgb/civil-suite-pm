import { NextResponse } from 'next/server';
import { getPartById, updatePart, deletePart } from '@/lib/equipment/db/spareParts.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleEquipError } from '@/lib/equipment/apiHelpers.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'equipment_spare_part', 'view');
    const part = getPartById(id);
    if (!part) return NextResponse.json({ success: false, error: 'القطعة غير موجودة.' }, { status: 404 });
    return NextResponse.json({ success: true, part });
  } catch (err) {
    return handleEquipError(err);
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'equipment_spare_part', 'edit');
    const part = updatePart(id, body, actor);
    return NextResponse.json({ success: true, part });
  } catch (err) {
    return handleEquipError(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const { actor, actor_role } = getActor(null, request);
    assertPermission(actor_role, 'equipment_spare_part', 'delete');
    const result = deletePart(id, actor);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return handleEquipError(err);
  }
}
