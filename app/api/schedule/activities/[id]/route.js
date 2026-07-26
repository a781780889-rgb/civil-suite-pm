import { NextResponse } from 'next/server';
import { getActivity, updateActivity, deleteActivity } from '@/lib/schedule/db/activities.js';
import { recalculateSchedule } from '@/lib/schedule/recalc.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';
import { assertPermission } from '@/lib/pm/roles.js';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'schedule', 'edit');
    const activity = updateActivity(Number(id), body, actor);
    const result = recalculateSchedule(activity.schedule_id);
    return NextResponse.json({ success: true, activity: getActivity(activity.id), recalc: result });
  } catch (err) {
    return handlePmError(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const { actor, actor_role } = getActor({}, request);
    assertPermission(actor_role, 'schedule', 'delete');
    const activity = getActivity(Number(id));
    if (!activity) return NextResponse.json({ success: false, error: 'النشاط غير موجود.' }, { status: 404 });
    deleteActivity(Number(id), actor);
    const result = recalculateSchedule(activity.schedule_id);
    return NextResponse.json({ success: true, recalc: result });
  } catch (err) {
    return handlePmError(err);
  }
}
