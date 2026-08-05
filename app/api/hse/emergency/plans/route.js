import { NextResponse } from 'next/server';
import { listEmergencyPlans, createEmergencyPlan } from '@/lib/hse/db/emergency.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_emergency', 'view');
    const plans = listEmergencyPlans({ project_id: searchParams.get('project_id') || undefined, plan_type: searchParams.get('plan_type') || undefined });
    return NextResponse.json({ success: true, plans });
  } catch (err) {
    return handleHseError(err);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'hse_emergency', 'create');
    const plan = createEmergencyPlan(body, actor);
    return NextResponse.json({ success: true, plan }, { status: 201 });
  } catch (err) {
    return handleHseError(err);
  }
}
