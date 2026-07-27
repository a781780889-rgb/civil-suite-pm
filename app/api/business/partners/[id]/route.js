import { NextResponse } from 'next/server';
import { getPartnerById, updatePartner, setPartnerStatus, findDuplicatePartner } from '@/lib/business/db/partners.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleBizError } from '@/lib/business/apiHelpers.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'biz_partner', 'view');
    const partner = getPartnerById(id);
    if (!partner) return NextResponse.json({ success: false, error: 'الشريك غير موجود.' }, { status: 404 });
    return NextResponse.json({ success: true, partner });
  } catch (err) {
    return handleBizError(err);
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'biz_partner', 'edit');
    if (body.status && Object.keys(body).length <= 2) {
      const updated = setPartnerStatus(id, body.status, actor);
      return NextResponse.json({ success: true, partner: updated });
    }
    const dup = findDuplicatePartner(body, Number(id));
    if (dup) return NextResponse.json({ success: false, error: `شريك مطابق آخر موجود بالفعل: "${dup.company_name}" (#${dup.id}).`, duplicateOf: dup }, { status: 409 });
    const updated = updatePartner(id, { ...body, actor });
    return NextResponse.json({ success: true, partner: updated });
  } catch (err) {
    return handleBizError(err);
  }
}
