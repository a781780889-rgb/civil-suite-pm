import { NextResponse } from 'next/server';
import { listWorkOrdersPaged, createWorkOrder, findDuplicateWoNo } from '@/lib/business/db/workOrders.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleBizError, pageParams } from '@/lib/business/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'biz_work_order', 'view');
    const result = listWorkOrdersPaged({
      status: searchParams.get('status') || undefined,
      project_id: searchParams.get('project_id') || undefined,
      contract_id: searchParams.get('contract_id') || undefined,
      partner_id: searchParams.get('partner_id') || undefined,
      search: searchParams.get('search') || undefined,
      ...pageParams(searchParams),
    });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return handleBizError(err);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'biz_work_order', 'create');
    if (body.wo_no && findDuplicateWoNo(body.wo_no)) {
      return NextResponse.json({ success: false, error: `رقم أمر العمل "${body.wo_no}" مستخدم بالفعل.` }, { status: 409 });
    }
    const created = createWorkOrder({ ...body, actor });
    return NextResponse.json({ success: true, workOrder: created }, { status: 201 });
  } catch (err) {
    return handleBizError(err);
  }
}
