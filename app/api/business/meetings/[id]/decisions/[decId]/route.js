import { NextResponse } from 'next/server';
import { updateDecisionStatus } from '@/lib/business/db/meetings.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleBizError } from '@/lib/business/apiHelpers.js';

export async function PATCH(request, { params }) {
  try {
    const { decId } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'biz_meeting', 'edit');
    const updated = updateDecisionStatus(decId, body.status, actor);
    return NextResponse.json({ success: true, decision: updated });
  } catch (err) {
    return handleBizError(err);
  }
}
