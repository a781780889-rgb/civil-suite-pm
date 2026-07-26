import { NextResponse } from 'next/server';
import { getSchedule } from '@/lib/schedule/db/schedules.js';
import { listActivities } from '@/lib/schedule/db/activities.js';
import { listRelationships } from '@/lib/schedule/db/relationships.js';
import { recalculateSchedule } from '@/lib/schedule/recalc.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';
import { assertPermission } from '@/lib/pm/roles.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'schedule', 'view');
    const schedule = getSchedule(Number(id));
    if (!schedule) return NextResponse.json({ success: false, error: 'الجدول الزمني غير موجود.' }, { status: 404 });
    const result = recalculateSchedule(schedule.id);
    const activities = listActivities(schedule.id);
    const relationships = listRelationships(schedule.id);
    return NextResponse.json({ success: true, schedule, activities, relationships, computed: result });
  } catch (err) {
    return handlePmError(err);
  }
}
