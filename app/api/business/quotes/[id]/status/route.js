import { NextResponse } from 'next/server';
import { transitionQuoteStatus } from '@/lib/business/db/quotes.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleBizError } from '@/lib/business/apiHelpers.js';

/** Workflow اعتماد (البند 18): status ∈ sent|under_review|negotiation|won|lost|expired. won/lost تتطلبان صلاحية approve. */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    const action = ['won', 'lost'].includes(body.status) ? 'approve' : 'edit';
    assertPermission(actor_role, 'biz_quote', action);
    const updated = transitionQuoteStatus(id, { ...body, actor, actor_role });
    return NextResponse.json({ success: true, quote: updated });
  } catch (err) {
    return handleBizError(err);
  }
}
