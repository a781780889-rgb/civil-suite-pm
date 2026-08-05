import { NextResponse } from 'next/server';
import { getBreakdownById, updateBreakdownProgress, resolveBreakdown } from '@/lib/equipment/db/breakdowns.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleEquipError } from '@/lib/equipment/apiHelpers.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'equipment_maintenance', 'view');
    const breakdown = getBreakdownById(id);
    if (!breakdown) return NextResponse.json({ success: false, error: 'العطل غير موجود.' }, { status: 404 });
    return NextResponse.json({ success: true, breakdown });
  } catch (err) {
    return handleEquipError(err);
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'equipment_maintenance', 'edit');
    const breakdown = body.action === 'resolve' ? resolveBreakdown(id, body, actor) : updateBreakdownProgress(id, body, actor);
    return NextResponse.json({ success: true, breakdown });
  } catch (err) {
    return handleEquipError(err);
  }
}
