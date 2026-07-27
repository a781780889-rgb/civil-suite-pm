import { NextResponse } from 'next/server';
import { getMeetingById, updateMeeting, deleteMeeting } from '@/lib/business/db/meetings.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleBizError } from '@/lib/business/apiHelpers.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'biz_meeting', 'view');
    const meeting = getMeetingById(id);
    if (!meeting) return NextResponse.json({ success: false, error: 'الاجتماع غير موجود.' }, { status: 404 });
    return NextResponse.json({ success: true, meeting });
  } catch (err) {
    return handleBizError(err);
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'biz_meeting', 'edit');
    const updated = updateMeeting(id, { ...body, actor });
    return NextResponse.json({ success: true, meeting: updated });
  } catch (err) {
    return handleBizError(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const { actor, actor_role } = getActor({}, request);
    assertPermission(actor_role, 'biz_meeting', 'delete');
    const result = deleteMeeting(id, actor);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return handleBizError(err);
  }
}
