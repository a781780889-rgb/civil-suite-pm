import { NextResponse } from 'next/server';
import { listAuthorizedOperators, authorizeOperator } from '@/lib/equipment/db/operators.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleEquipError } from '@/lib/equipment/apiHelpers.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'equipment_operator', 'view');
    return NextResponse.json({ success: true, rows: listAuthorizedOperators(id) });
  } catch (err) {
    return handleEquipError(err);
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'equipment_operator', 'edit');
    const rows = authorizeOperator(body.operator_id, id, body.notes, actor);
    return NextResponse.json({ success: true, rows });
  } catch (err) {
    return handleEquipError(err);
  }
}
