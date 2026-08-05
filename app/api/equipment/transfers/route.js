import { NextResponse } from 'next/server';
import { listTransfers, createTransfer } from '@/lib/equipment/db/transfers.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleEquipError } from '@/lib/equipment/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'equipment', 'view');
    const data = listTransfers({
      equipment_id: searchParams.get('equipment_id') || undefined, status: searchParams.get('status') || undefined,
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
    assertPermission(actor_role, 'equipment', 'create');
    const transfer = createTransfer(body, actor);
    return NextResponse.json({ success: true, transfer }, { status: 201 });
  } catch (err) {
    return handleEquipError(err);
  }
}
