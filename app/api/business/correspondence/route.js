import { NextResponse } from 'next/server';
import { listCorrespondencePaged, createCorrespondence } from '@/lib/business/db/correspondence.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleBizError, pageParams } from '@/lib/business/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'biz_correspondence', 'view');
    const result = listCorrespondencePaged({
      status: searchParams.get('status') || undefined,
      direction: searchParams.get('direction') || undefined,
      client_id: searchParams.get('client_id') || undefined,
      contract_id: searchParams.get('contract_id') || undefined,
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
    assertPermission(actor_role, 'biz_correspondence', 'create');
    const created = createCorrespondence({ ...body, actor });
    return NextResponse.json({ success: true, correspondence: created }, { status: 201 });
  } catch (err) {
    return handleBizError(err);
  }
}
