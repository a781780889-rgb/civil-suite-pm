import { NextResponse } from 'next/server';
import { createContractFromQuote } from '@/lib/business/db/contracts.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleBizError } from '@/lib/business/apiHelpers.js';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'biz_contract', 'create');
    const contract = createContractFromQuote(id, { ...body, actor, actor_role });
    return NextResponse.json({ success: true, contract }, { status: 201 });
  } catch (err) {
    return handleBizError(err);
  }
}
