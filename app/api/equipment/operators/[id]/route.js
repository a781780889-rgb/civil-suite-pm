import { NextResponse } from 'next/server';
import { getOperatorById, updateOperator, deleteOperator } from '@/lib/equipment/db/operators.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleEquipError } from '@/lib/equipment/apiHelpers.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'equipment_operator', 'view');
    const operator = getOperatorById(id);
    if (!operator) return NextResponse.json({ success: false, error: 'المشغل غير موجود.' }, { status: 404 });
    return NextResponse.json({ success: true, operator });
  } catch (err) {
    return handleEquipError(err);
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'equipment_operator', 'edit');
    const operator = updateOperator(id, body, actor);
    return NextResponse.json({ success: true, operator });
  } catch (err) {
    return handleEquipError(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const { actor, actor_role } = getActor(null, request);
    assertPermission(actor_role, 'equipment_operator', 'delete');
    const result = deleteOperator(id, actor);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return handleEquipError(err);
  }
}
