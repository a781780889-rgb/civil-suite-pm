import { NextResponse } from 'next/server';
import { getOpportunityById, updateOpportunity, changeOpportunityStage, hardDeleteOpportunity } from '@/lib/business/db/opportunities.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleBizError } from '@/lib/business/apiHelpers.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'biz_opportunity', 'view');
    const opp = getOpportunityById(id);
    if (!opp) return NextResponse.json({ success: false, error: 'الفرصة غير موجودة.' }, { status: 404 });
    return NextResponse.json({ success: true, opportunity: opp });
  } catch (err) {
    return handleBizError(err);
  }
}

/** action='change_stage' في الجسم يُحوَّل لـ changeOpportunityStage (يفرض lost_reason عند الخسارة)، وإلا تحديث عادي. */
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'biz_opportunity', 'edit');
    if (body.action === 'change_stage') {
      const updated = changeOpportunityStage(id, body.stage, { lost_reason: body.lost_reason, actor });
      return NextResponse.json({ success: true, opportunity: updated });
    }
    const updated = updateOpportunity(id, { ...body, actor });
    return NextResponse.json({ success: true, opportunity: updated });
  } catch (err) {
    return handleBizError(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const { actor, actor_role } = getActor({}, request);
    assertPermission(actor_role, 'biz_opportunity', 'delete');
    const result = hardDeleteOpportunity(id, actor);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return handleBizError(err);
  }
}
