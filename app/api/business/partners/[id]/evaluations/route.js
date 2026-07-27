import { NextResponse } from 'next/server';
import { addPartnerEvaluation, getPartnerById } from '@/lib/business/db/partners.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleBizError } from '@/lib/business/apiHelpers.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'biz_partner', 'view');
    return NextResponse.json({ success: true, evaluations: getPartnerById(id)?.evaluations || [] });
  } catch (err) {
    return handleBizError(err);
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'biz_partner', 'edit');
    const created = addPartnerEvaluation(id, { ...body, actor });
    return NextResponse.json({ success: true, evaluation: created }, { status: 201 });
  } catch (err) {
    return handleBizError(err);
  }
}
