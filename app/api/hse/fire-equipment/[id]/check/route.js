import { NextResponse } from 'next/server';
import { recordFireEquipmentCheck, listFireEquipmentChecks } from '@/lib/hse/db/fireEquipment.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_emergency', 'view');
    const checks = listFireEquipmentChecks(Number(id));
    return NextResponse.json({ success: true, checks });
  } catch (err) {
    return handleHseError(err);
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'hse_emergency', 'edit');
    const equipment = recordFireEquipmentCheck(Number(id), body, actor);
    return NextResponse.json({ success: true, equipment });
  } catch (err) {
    return handleHseError(err);
  }
}
