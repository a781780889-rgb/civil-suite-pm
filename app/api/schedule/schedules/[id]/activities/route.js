import { NextResponse } from 'next/server';
import { listActivities, createActivity } from '@/lib/schedule/db/activities.js';
import { recalculateSchedule } from '@/lib/schedule/recalc.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';
import { assertPermission } from '@/lib/pm/roles.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'schedule', 'view');
    return NextResponse.json({ success: true, activities: listActivities(Number(id)) });
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
    const activity = createActivity({ ...body, schedule_id: Number(id) }, actor);
    const result = recalculateSchedule(Number(id));
    return NextResponse.json({ success: true, activity, recalc: result });
  } catch (err) {
    return handlePmError(err);
  }
}
