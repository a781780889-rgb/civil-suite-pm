import { NextResponse } from 'next/server';
import { closeRisk } from '@/lib/hse/db/risks.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { actor, actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_risk', 'approve');
    const risk = closeRisk(Number(id), actor);
    return NextResponse.json({ success: true, risk });
  } catch (err) {
    return handleHseError(err);
  }
}
