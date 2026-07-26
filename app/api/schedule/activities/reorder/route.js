import { NextResponse } from 'next/server';
import { reorderActivities } from '@/lib/schedule/db/activities.js';
import { recalculateSchedule } from '@/lib/schedule/recalc.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';
import { assertPermission } from '@/lib/pm/roles.js';

/** body: { schedule_id, items: [{ id, parent_id, sequence }] } */
export async function POST(request) {
  try {
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'schedule', 'edit');
    if (!body.schedule_id || !Array.isArray(body.items)) {
      return NextResponse.json({ success: false, error: 'schedule_id وitems مطلوبان.' }, { status: 400 });
    }
    const activities = reorderActivities(Number(body.schedule_id), body.items, actor);
    const result = recalculateSchedule(Number(body.schedule_id));
    return NextResponse.json({ success: true, activities, recalc: result });
  } catch (err) {
    return handlePmError(err);
  }
}
