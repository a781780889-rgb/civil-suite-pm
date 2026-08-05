import { NextResponse } from 'next/server';
import { suggestPreventiveActions } from '@/lib/hse/ai.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const { actor_role } = getActor(body, request);
    assertPermission(actor_role, 'hse_risk', 'view');
    const result = await suggestPreventiveActions(body);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return handleHseError(err);
  }
}
