import { NextResponse } from 'next/server';
import { getWorkOrderById, updateWorkOrder, transitionWorkOrderStatus, deleteWorkOrder, findDuplicateWoNo } from '@/lib/business/db/workOrders.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleBizError } from '@/lib/business/apiHelpers.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'biz_work_order', 'view');
    const wo = getWorkOrderById(id);
    if (!wo) return NextResponse.json({ success: false, error: 'أمر العمل غير موجود.' }, { status: 404 });
    return NextResponse.json({ success: true, workOrder: wo });
  } catch (err) {
    return handleBizError(err);
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'biz_work_order', 'edit');
    if (body.status && Object.keys(body).length <= 2) {
      const updated = transitionWorkOrderStatus(id, body.status, actor);
      return NextResponse.json({ success: true, workOrder: updated });
    }
    if (body.wo_no && findDuplicateWoNo(body.wo_no, Number(id))) {
      return NextResponse.json({ success: false, error: `رقم أمر العمل "${body.wo_no}" مستخدم بالفعل.` }, { status: 409 });
    }
    const updated = updateWorkOrder(id, { ...body, actor });
    return NextResponse.json({ success: true, workOrder: updated });
  } catch (err) {
    return handleBizError(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const { actor, actor_role } = getActor({}, request);
    assertPermission(actor_role, 'biz_work_order', 'delete');
    const result = deleteWorkOrder(id, actor);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return handleBizError(err);
  }
}
