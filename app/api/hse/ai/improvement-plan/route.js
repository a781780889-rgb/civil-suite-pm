import { NextResponse } from 'next/server';
import { generateSafetyImprovementPlan } from '@/lib/hse/ai.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { actor_role } = getActor(body, request);
    assertPermission(actor_role, 'hse_risk', 'view');
    const result = await generateSafetyImprovementPlan(body.project_id ? Number(body.project_id) : undefined);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return handleHseError(err);
  }
}
