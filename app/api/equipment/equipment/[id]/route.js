import { NextResponse } from 'next/server';
import { getEquipmentById, updateEquipment, archiveEquipment, deleteEquipmentHard } from '@/lib/equipment/db/equipment.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleEquipError } from '@/lib/equipment/apiHelpers.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'equipment', 'view');
    const equipment = getEquipmentById(id);
    if (!equipment) return NextResponse.json({ success: false, error: 'المعدة غير موجودة.' }, { status: 404 });
    return NextResponse.json({ success: true, equipment });
  } catch (err) {
    return handleEquipError(err);
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'equipment', 'edit');
    const equipment = updateEquipment(id, body, actor);
    return NextResponse.json({ success: true, equipment });
  } catch (err) {
    return handleEquipError(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const { actor, actor_role } = getActor(null, request);
    if (searchParams.get('mode') === 'hard') {
      assertPermission(actor_role, 'equipment', 'delete');
      const result = deleteEquipmentHard(id, actor);
      return NextResponse.json({ success: true, ...result });
    }
    assertPermission(actor_role, 'equipment', 'delete');
    const equipment = archiveEquipment(id, actor);
    return NextResponse.json({ success: true, equipment });
  } catch (err) {
    return handleEquipError(err);
  }
}
