import { NextResponse } from 'next/server';
import { closeNearMiss } from '@/lib/hse/db/nearMisses.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { actor, actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_incident', 'edit');
    const nearMiss = closeNearMiss(Number(id), actor);
    return NextResponse.json({ success: true, near_miss: nearMiss });
  } catch (err) {
    return handleHseError(err);
  }
}
