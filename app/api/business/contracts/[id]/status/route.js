import { NextResponse } from 'next/server';
import { transitionContractStatus } from '@/lib/business/db/contracts.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleBizError } from '@/lib/business/apiHelpers.js';

/** Workflow اعتماد (البند 18): تفعيل العقد (active) يتطلب صلاحية approve. */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'biz_contract', body.status === 'active' ? 'approve' : 'edit');
    const updated = transitionContractStatus(id, { ...body, actor, actor_role });
    return NextResponse.json({ success: true, contract: updated });
  } catch (err) {
    return handleBizError(err);
  }
}
