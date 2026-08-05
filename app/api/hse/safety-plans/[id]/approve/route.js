import { NextResponse } from 'next/server';
import { approveSafetyPlanDocument } from '@/lib/hse/db/safetyPlans.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'document', 'approve');
    const document = approveSafetyPlanDocument(Number(id), body, actor);
    return NextResponse.json({ success: true, document });
  } catch (err) {
    return handleHseError(err);
  }
}
