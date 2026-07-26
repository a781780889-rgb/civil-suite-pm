import { NextResponse } from 'next/server';
import { getSchedule } from '@/lib/schedule/db/schedules.js';
import { listActivities } from '@/lib/schedule/db/activities.js';
import { listBaselines } from '@/lib/schedule/db/baselines.js';
import { listPmAuditLog } from '@/lib/pm/db/audit.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';
import { assertPermission } from '@/lib/pm/roles.js';

const SCHEDULE_ENTITY_TYPES = new Set(['schedule', 'sch_activity', 'sch_relationship', 'sch_activity_resource', 'sch_baseline']);

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'schedule', 'view');
    const schedule = getSchedule(Number(id));
    if (!schedule) return NextResponse.json({ success: false, error: 'الجدول الزمني غير موجود.' }, { status: 404 });

    const activityIds = new Set(listActivities(schedule.id).map((a) => a.id));
    const baselineIds = new Set(listBaselines(schedule.id).map((b) => b.id));

    const all = listPmAuditLog({ project_id: schedule.project_id, limit: 500 });
    const scoped = all.filter((row) => {
      if (!SCHEDULE_ENTITY_TYPES.has(row.entity_type)) return false;
      if (row.entity_type === 'schedule') return row.entity_id === schedule.id;
      if (row.entity_type === 'sch_baseline') return baselineIds.has(row.entity_id);
      return activityIds.has(row.entity_id) || row.entity_id == null;
    });
    return NextResponse.json({ success: true, log: scoped });
  } catch (err) {
    return handlePmError(err);
  }
}
