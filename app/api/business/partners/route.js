import { NextResponse } from 'next/server';
import { listPartnersPaged, createPartner, findDuplicatePartner } from '@/lib/business/db/partners.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleBizError, pageParams } from '@/lib/business/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'biz_partner', 'view');
    const result = listPartnersPaged({
      partner_type: searchParams.get('partner_type') || undefined,
      status: searchParams.get('status') || undefined,
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
    assertPermission(actor_role, 'biz_partner', 'create');
    const dup = findDuplicatePartner(body);
    if (dup) return NextResponse.json({ success: false, error: `شريك مطابق موجود بالفعل: "${dup.company_name}" (#${dup.id}).`, duplicateOf: dup }, { status: 409 });
    const created = createPartner({ ...body, actor });
    return NextResponse.json({ success: true, partner: created }, { status: 201 });
  } catch (err) {
    return handleBizError(err);
  }
}
