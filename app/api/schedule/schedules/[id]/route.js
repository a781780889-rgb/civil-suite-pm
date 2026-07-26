import { NextResponse } from 'next/server';
import { getSchedule, updateSchedule, archiveSchedule, hardDeleteSchedule, setPrimarySchedule } from '@/lib/schedule/db/schedules.js';
import { listActivities } from '@/lib/schedule/db/activities.js';
import { listRelationships } from '@/lib/schedule/db/relationships.js';
import { recalculateSchedule } from '@/lib/schedule/recalc.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';
import { assertPermission, PmPermissionError } from '@/lib/pm/roles.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'schedule', 'view');
    const schedule = getSchedule(Number(id));
    if (!schedule) return NextResponse.json({ success: false, error: 'الجدول الزمني غير موجود.' }, { status: 404 });
    const activities = listActivities(schedule.id);
    const relationships = listRelationships(schedule.id);
    return NextResponse.json({ success: true, schedule, activities, relationships });
  } catch (err) {
    return handlePmError(err);
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'schedule', 'edit');
    if (body.set_primary) {
      const schedule = setPrimarySchedule(Number(id), actor);
      return NextResponse.json({ success: true, schedule });
    }
    const schedule = updateSchedule(Number(id), body, actor);
    const result = recalculateSchedule(schedule.id);
    return NextResponse.json({ success: true, schedule: getSchedule(schedule.id), recalc: result });
  } catch (err) {
    return handlePmError(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const { actor, actor_role } = getActor({}, request);
    if (searchParams.get('hard') === '1') {
      // القاعدة الثانية الإلزامية: حذف نهائي لا يُسمح به إلا لمدير النظام تحديداً (أشد من مستوى "full" العام)
      if (actor_role !== 'system_admin') throw new PmPermissionError(actor_role, 'schedule', 'hard_delete');
      hardDeleteSchedule(Number(id), actor);
      return NextResponse.json({ success: true, hardDeleted: true });
    }
    assertPermission(actor_role, 'schedule', 'delete');
    const schedule = archiveSchedule(Number(id), actor);
    return NextResponse.json({ success: true, schedule });
  } catch (err) {
    return handlePmError(err);
  }
}
