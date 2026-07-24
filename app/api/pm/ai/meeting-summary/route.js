import { NextResponse } from 'next/server';
import { getMeeting, listDecisions } from '@/lib/pm/db/meetings.js';
import { summarizeMeeting } from '@/lib/pm/ai.js';
import { handlePmError } from '@/lib/pm/apiHelpers.js';

export async function POST(request) {
  try {
    const body = await request.json();
    if (!body.meeting_id) return NextResponse.json({ success: false, error: 'meeting_id مطلوب.' }, { status: 400 });
    const meeting = getMeeting(Number(body.meeting_id));
    if (!meeting) return NextResponse.json({ success: false, error: 'الاجتماع غير موجود.' }, { status: 404 });
    const summary = await summarizeMeeting({ meeting, decisions: listDecisions(meeting.id) });
    return NextResponse.json({ success: true, summary });
  } catch (err) {
    return handlePmError(err);
  }
}
