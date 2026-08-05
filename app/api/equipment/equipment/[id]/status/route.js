import { NextResponse } from 'next/server';
import { changeEquipmentStatus, listStatusLog } from '@/lib/equipment/db/equipment.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleEquipError } from '@/lib/equipment/apiHelpers.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'equipment', 'view');
    return NextResponse.json({ success: true, rows: listStatusLog(id) });
  } catch (err) {
    return handleEquipError(err);
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'equipment', 'edit');
    const equipment = changeEquipmentStatus(id, body.status, body.note, actor);
    return NextResponse.json({ success: true, equipment });
  } catch (err) {
    return handleEquipError(err);
  }
}
