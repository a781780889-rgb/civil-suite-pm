import { NextResponse } from 'next/server';
import { listContractsPaged, createContract, findDuplicateContractNo } from '@/lib/business/db/contracts.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleBizError, pageParams } from '@/lib/business/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'biz_contract', 'view');
    const result = listContractsPaged({
      status: searchParams.get('status') || undefined,
      client_id: searchParams.get('client_id') || undefined,
      project_id: searchParams.get('project_id') || undefined,
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
    assertPermission(actor_role, 'biz_contract', 'create');
    if (body.contract_no && findDuplicateContractNo(body.contract_no)) {
      return NextResponse.json({ success: false, error: `رقم العقد "${body.contract_no}" مستخدم بالفعل.` }, { status: 409 });
    }
    const created = createContract({ ...body, actor });
    return NextResponse.json({ success: true, contract: created }, { status: 201 });
  } catch (err) {
    return handleBizError(err);
  }
}
