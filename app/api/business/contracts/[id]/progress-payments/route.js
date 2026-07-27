import { NextResponse } from 'next/server';
import { listProgressPayments, createProgressPayment } from '@/lib/business/db/progressPayments.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleBizError } from '@/lib/business/apiHelpers.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'biz_payment', 'view');
    return NextResponse.json({ success: true, payments: listProgressPayments(id) });
  } catch (err) {
    return handleBizError(err);
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'biz_payment', 'create');
    const created = createProgressPayment(id, { ...body, actor });
    return NextResponse.json({ success: true, payment: created }, { status: 201 });
  } catch (err) {
    return handleBizError(err);
  }
}
