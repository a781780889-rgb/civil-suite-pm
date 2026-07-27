import { NextResponse } from 'next/server';
import { listOpportunitiesPaged, listOpenOpportunities, createOpportunity } from '@/lib/business/db/opportunities.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleBizError, pageParams } from '@/lib/business/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'biz_opportunity', 'view');
    if (searchParams.get('view') === 'pipeline') {
      return NextResponse.json({ success: true, opportunities: listOpenOpportunities() });
    }
    const result = listOpportunitiesPaged({
      stage: searchParams.get('stage') || undefined,
      client_id: searchParams.get('client_id') || undefined,
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
    assertPermission(actor_role, 'biz_opportunity', 'create');
    const created = createOpportunity({ ...body, actor });
    return NextResponse.json({ success: true, opportunity: created }, { status: 201 });
  } catch (err) {
    return handleBizError(err);
  }
}
