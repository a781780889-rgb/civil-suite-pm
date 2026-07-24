import { NextResponse } from 'next/server';
import { listMeetings, createMeeting } from '@/lib/pm/db/meetings.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    return NextResponse.json({ success: true, meetings: listMeetings({ project_id: projectId ? Number(projectId) : undefined }) });
  } catch (err) {
    return handlePmError(err);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'meeting', 'create');
    if (!body.project_id || !body.title) return NextResponse.json({ success: false, error: 'project_id وعنوان الاجتماع مطلوبان.' }, { status: 400 });
    const meeting = createMeeting({ ...body, actor });
    return NextResponse.json({ success: true, meeting }, { status: 201 });
  } catch (err) {
    return handlePmError(err);
  }
}
