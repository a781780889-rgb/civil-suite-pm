import { NextResponse } from 'next/server';
import { getEmergencyPlanById, updateEmergencyPlan } from '@/lib/hse/db/emergency.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_emergency', 'view');
    const plan = getEmergencyPlanById(Number(id));
    if (!plan) return NextResponse.json({ success: false, error: 'خطة الطوارئ غير موجودة.' }, { status: 404 });
    return NextResponse.json({ success: true, plan });
  } catch (err) {
    return handleHseError(err);
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'hse_emergency', 'edit');
    const plan = updateEmergencyPlan(Number(id), body, actor);
    return NextResponse.json({ success: true, plan });
  } catch (err) {
    return handleHseError(err);
  }
}
