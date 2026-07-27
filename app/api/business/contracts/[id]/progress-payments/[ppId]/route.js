import { NextResponse } from 'next/server';
import { submitProgressPayment, decideProgressPayment, markProgressPaymentPaid } from '@/lib/business/db/progressPayments.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleBizError } from '@/lib/business/apiHelpers.js';

/** action: 'submit' | 'approve' | 'reject' (تتطلبان approve) | 'pay' (تسجيل صرف فعلي، تتطلب approve أيضاً). */
export async function PATCH(request, { params }) {
  try {
    const { ppId } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    if (body.action === 'submit') {
      assertPermission(actor_role, 'biz_payment', 'edit');
      return NextResponse.json({ success: true, payment: submitProgressPayment(ppId, { actor, actor_role }) });
    }
    if (body.action === 'approve' || body.action === 'reject') {
      assertPermission(actor_role, 'biz_payment', 'approve');
      return NextResponse.json({ success: true, payment: decideProgressPayment(ppId, { approved: body.action === 'approve', notes: body.notes, actor, actor_role }) });
    }
    if (body.action === 'pay') {
      assertPermission(actor_role, 'biz_payment', 'approve');
      return NextResponse.json({ success: true, payment: markProgressPaymentPaid(ppId, { actor }) });
    }
    return NextResponse.json({ success: false, error: 'action يجب أن تكون submit أو approve أو reject أو pay.' }, { status: 400 });
  } catch (err) {
    return handleBizError(err);
  }
}
