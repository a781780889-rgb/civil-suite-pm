import { NextResponse } from 'next/server';
import { getSchedule } from '@/lib/schedule/db/schedules.js';
import { listActivities } from '@/lib/schedule/db/activities.js';
import { listRelationships } from '@/lib/schedule/db/relationships.js';
import { askScheduleAssistant } from '@/lib/schedule/ai.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';
import { assertPermission } from '@/lib/pm/roles.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const { actor_role } = getActor(body, request);
    assertPermission(actor_role, 'schedule', 'view');
    if (!body.schedule_id || !body.question?.trim()) {
      return NextResponse.json({ success: false, error: 'schedule_id وquestion مطلوبان.' }, { status: 400 });
    }
    const schedule = getSchedule(Number(body.schedule_id));
    if (!schedule) return NextResponse.json({ success: false, error: 'الجدول الزمني غير موجود.' }, { status: 404 });

    const activities = listActivities(schedule.id);
    const relationships = listRelationships(schedule.id);
    const contextData = {
      activitiesCount: activities.length,
      activities: activities.slice(0, 200).map((a) => ({
        wbs: a.wbs_code, name: a.name, status: a.status, planned_start: a.planned_start, planned_end: a.planned_end,
        progress_pct: a.progress_pct, is_critical: !!a.is_critical, total_float_days: a.total_float_days,
      })),
      relationshipsCount: relationships.length,
    };
    const result = await askScheduleAssistant({ schedule, contextData, question: body.question.trim() });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return handlePmError(err);
  }
}
