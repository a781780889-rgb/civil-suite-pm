import { NextResponse } from 'next/server';
import { listSchedules, createSchedule } from '@/lib/schedule/db/schedules.js';
import { recalculateSchedule } from '@/lib/schedule/recalc.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';
import { assertPermission } from '@/lib/pm/roles.js';

export async function GET(request) {
  try {
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'schedule', 'view');
    const { searchParams } = new URL(request.url);
    const project_id = searchParams.get('project_id') ? Number(searchParams.get('project_id')) : undefined;
    const status = searchParams.get('status') || undefined;
    return NextResponse.json({ success: true, schedules: listSchedules({ project_id, status }) });
  } catch (err) {
    return handlePmError(err);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'schedule', 'edit');
    const schedule = createSchedule(body, actor);
    recalculateSchedule(schedule.id);
    return NextResponse.json({ success: true, schedule: listSchedules({ project_id: schedule.project_id }).find((s) => s.id === schedule.id) });
  } catch (err) {
    return handlePmError(err);
  }
}
