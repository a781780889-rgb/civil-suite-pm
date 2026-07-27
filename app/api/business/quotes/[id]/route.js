import { NextResponse } from 'next/server';
import { getQuoteById, updateQuoteHeader, hardDeleteQuote, findDuplicateQuoteNo } from '@/lib/business/db/quotes.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleBizError } from '@/lib/business/apiHelpers.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'biz_quote', 'view');
    const quote = getQuoteById(id);
    if (!quote) return NextResponse.json({ success: false, error: 'عرض السعر غير موجود.' }, { status: 404 });
    return NextResponse.json({ success: true, quote });
  } catch (err) {
    return handleBizError(err);
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'biz_quote', 'edit');
    if (body.quote_no && findDuplicateQuoteNo(body.quote_no, Number(id))) {
      return NextResponse.json({ success: false, error: `رقم عرض السعر "${body.quote_no}" مستخدم بالفعل.` }, { status: 409 });
    }
    const updated = updateQuoteHeader(id, { ...body, actor });
    return NextResponse.json({ success: true, quote: updated });
  } catch (err) {
    return handleBizError(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const { actor, actor_role } = getActor({}, request);
    assertPermission(actor_role, 'biz_quote', 'delete');
    const result = hardDeleteQuote(id, actor);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return handleBizError(err);
  }
}
