import { NextResponse } from 'next/server';
import { closeViolation } from '@/lib/hse/db/violations.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { actor, actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_inspection', 'approve');
    const violation = closeViolation(Number(id), actor);
    return NextResponse.json({ success: true, violation });
  } catch (err) {
    return handleHseError(err);
  }
}
