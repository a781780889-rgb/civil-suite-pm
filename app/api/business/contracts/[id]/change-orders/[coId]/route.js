import { NextResponse } from 'next/server';
import { submitChangeOrder, decideChangeOrder } from '@/lib/business/db/changeOrders.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleBizError } from '@/lib/business/apiHelpers.js';

/** action: 'submit' (بلا اعتماد) | 'approve' | 'reject' (تتطلبان صلاحية approve) - Workflow البند 18. */
export async function PATCH(request, { params }) {
  try {
    const { coId } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    if (body.action === 'submit') {
      assertPermission(actor_role, 'biz_payment', 'edit');
      const updated = submitChangeOrder(coId, { actor, actor_role });
      return NextResponse.json({ success: true, changeOrder: updated });
    }
    if (body.action === 'approve' || body.action === 'reject') {
      assertPermission(actor_role, 'biz_payment', 'approve');
      const updated = decideChangeOrder(coId, { approved: body.action === 'approve', notes: body.notes, actor, actor_role });
      return NextResponse.json({ success: true, changeOrder: updated });
    }
    return NextResponse.json({ success: false, error: 'action يجب أن تكون submit أو approve أو reject.' }, { status: 400 });
  } catch (err) {
    return handleBizError(err);
  }
}
