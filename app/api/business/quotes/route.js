import { NextResponse } from 'next/server';
import { listQuotesPaged, createQuote, findDuplicateQuoteNo } from '@/lib/business/db/quotes.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleBizError, pageParams } from '@/lib/business/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'biz_quote', 'view');
    const result = listQuotesPaged({
      status: searchParams.get('status') || undefined,
      client_id: searchParams.get('client_id') || undefined,
      opportunity_id: searchParams.get('opportunity_id') || undefined,
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
    assertPermission(actor_role, 'biz_quote', 'create');
    if (body.quote_no && findDuplicateQuoteNo(body.quote_no)) {
      return NextResponse.json({ success: false, error: `رقم عرض السعر "${body.quote_no}" مستخدم بالفعل.` }, { status: 409 });
    }
    const created = createQuote({ ...body, actor });
    return NextResponse.json({ success: true, quote: created }, { status: 201 });
  } catch (err) {
    return handleBizError(err);
  }
}
