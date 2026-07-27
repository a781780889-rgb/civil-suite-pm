import { NextResponse } from 'next/server';
import { getContractById, updateContract, findDuplicateContractNo } from '@/lib/business/db/contracts.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleBizError } from '@/lib/business/apiHelpers.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'biz_contract', 'view');
    const contract = getContractById(id);
    if (!contract) return NextResponse.json({ success: false, error: 'العقد غير موجود.' }, { status: 404 });
    return NextResponse.json({ success: true, contract });
  } catch (err) {
    return handleBizError(err);
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'biz_contract', 'edit');
    if (body.contract_no && findDuplicateContractNo(body.contract_no, Number(id))) {
      return NextResponse.json({ success: false, error: `رقم العقد "${body.contract_no}" مستخدم بالفعل.` }, { status: 409 });
    }
    const updated = updateContract(id, { ...body, actor });
    return NextResponse.json({ success: true, contract: updated });
  } catch (err) {
    return handleBizError(err);
  }
}
