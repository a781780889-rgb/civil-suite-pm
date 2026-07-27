import { NextResponse } from 'next/server';
import { listClientsPaged, createClient, findDuplicateClient } from '@/lib/business/db/clients.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleBizError, pageParams } from '@/lib/business/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'biz_client', 'view');
    const result = listClientsPaged({
      status: searchParams.get('status') || undefined,
      client_type: searchParams.get('client_type') || undefined,
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
    assertPermission(actor_role, 'biz_client', 'create');
    const dup = findDuplicateClient(body);
    if (dup) return NextResponse.json({ success: false, error: `عميل مطابق موجود بالفعل: "${dup.name}" (#${dup.id}) - يُمنع تكرار العميل نفسه.`, duplicateOf: dup }, { status: 409 });
    const created = createClient({ ...body, actor });
    return NextResponse.json({ success: true, client: created }, { status: 201 });
  } catch (err) {
    return handleBizError(err);
  }
}
