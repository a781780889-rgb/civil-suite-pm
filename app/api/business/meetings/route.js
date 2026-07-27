import { NextResponse } from 'next/server';
import { listMeetingsPaged, createMeeting } from '@/lib/business/db/meetings.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleBizError, pageParams } from '@/lib/business/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'biz_meeting', 'view');
    const result = listMeetingsPaged({
      client_id: searchParams.get('client_id') || undefined,
      contract_id: searchParams.get('contract_id') || undefined,
      project_id: searchParams.get('project_id') || undefined,
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
    assertPermission(actor_role, 'biz_meeting', 'create');
    const created = createMeeting({ ...body, actor });
    return NextResponse.json({ success: true, meeting: created }, { status: 201 });
  } catch (err) {
    return handleBizError(err);
  }
}
