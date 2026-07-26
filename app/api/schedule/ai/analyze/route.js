import { NextResponse } from 'next/server';
import { getSchedule } from '@/lib/schedule/db/schedules.js';
import { listActivities } from '@/lib/schedule/db/activities.js';
import { listResourcesForSchedule, findResourceConflicts } from '@/lib/schedule/db/resources.js';
import { recalculateSchedule } from '@/lib/schedule/recalc.js';
import { findDelayedActivities } from '@/lib/schedule/criticalPath.js';
import { analyzeSchedule } from '@/lib/schedule/ai.js';
import { sdb } from '@/lib/schedule/schema.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';
import { assertPermission } from '@/lib/pm/roles.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const { actor_role } = getActor(body, request);
    assertPermission(actor_role, 'schedule', 'view');
    if (!body.schedule_id) return NextResponse.json({ success: false, error: 'schedule_id مطلوب.' }, { status: 400 });

    const schedule = getSchedule(Number(body.schedule_id));
    if (!schedule) return NextResponse.json({ success: false, error: 'الجدول الزمني غير موجود.' }, { status: 404 });

    const computedResult = recalculateSchedule(schedule.id);
    const activities = listActivities(schedule.id);
    const critical = activities.filter((a) => a.is_critical);
    const delayed = findDelayedActivities(activities, new Date().toISOString().slice(0, 10));

    const assignments = listResourcesForSchedule(schedule.id);
    const uniqueResourceIds = [...new Set(assignments.map((a) => a.resource_id))];
    const resourceConflicts = uniqueResourceIds.flatMap((rid) => findResourceConflicts(rid));

    const project = sdb().prepare(`SELECT end_date FROM projects WHERE id = ?`).get(schedule.project_id);

    const analysis = await analyzeSchedule({
      schedule, activities, delayedActivities: delayed, criticalActivities: critical,
      resourceConflicts, projectEndDate: computedResult.projectEndDate, targetEndDate: project?.end_date,
    });
    return NextResponse.json({ success: true, analysis });
  } catch (err) {
    return handlePmError(err);
  }
}
