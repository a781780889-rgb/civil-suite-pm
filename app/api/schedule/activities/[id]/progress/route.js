import { NextResponse } from 'next/server';
import { listProgressLog, logProgress } from '@/lib/schedule/db/progress.js';
import { recalculateSchedule } from '@/lib/schedule/recalc.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';
import { assertPermission } from '@/lib/pm/roles.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'schedule', 'view');
    return NextResponse.json({ success: true, log: listProgressLog(Number(id)) });
  } catch (err) {
    return handlePmError(err);
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'schedule', 'edit');
    const activity = logProgress({ ...body, activity_id: Number(id) }, actor);
    const result = recalculateSchedule(activity.schedule_id);
    return NextResponse.json({ success: true, activity, recalc: result });
  } catch (err) {
    return handlePmError(err);
  }
}
