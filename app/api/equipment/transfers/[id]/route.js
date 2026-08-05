import { NextResponse } from 'next/server';
import { completeTransfer, cancelTransfer } from '@/lib/equipment/db/transfers.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleEquipError } from '@/lib/equipment/apiHelpers.js';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'equipment', 'edit');
    const transfer = body.action === 'cancel' ? cancelTransfer(id, actor) : completeTransfer(id, actor);
    return NextResponse.json({ success: true, transfer });
  } catch (err) {
    return handleEquipError(err);
  }
}
