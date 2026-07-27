import { NextResponse } from 'next/server';
import { replaceQuoteItems } from '@/lib/business/db/quotes.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleBizError } from '@/lib/business/apiHelpers.js';

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'biz_quote', 'edit');
    const updated = replaceQuoteItems(id, body.items || [], actor);
    return NextResponse.json({ success: true, quote: updated });
  } catch (err) {
    return handleBizError(err);
  }
}
