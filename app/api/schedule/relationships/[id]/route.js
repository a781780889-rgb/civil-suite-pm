import { NextResponse } from 'next/server';
import { updateRelationship, deleteRelationship } from '@/lib/schedule/db/relationships.js';
import { getActivity } from '@/lib/schedule/db/activities.js';
import { sdb } from '@/lib/schedule/schema.js';
import { recalculateSchedule } from '@/lib/schedule/recalc.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';
import { assertPermission } from '@/lib/pm/roles.js';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'schedule', 'edit');
    const relationship = updateRelationship(Number(id), body, actor);
    const activity = getActivity(relationship.predecessor_id);
    const result = recalculateSchedule(activity.schedule_id);
    return NextResponse.json({ success: true, relationship, recalc: result });
  } catch (err) {
    return handlePmError(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const { actor, actor_role } = getActor({}, request);
    assertPermission(actor_role, 'schedule', 'delete');
    const before = sdb().prepare(`SELECT * FROM sch_relationships WHERE id = ?`).get(Number(id));
    if (!before) return NextResponse.json({ success: false, error: 'العلاقة غير موجودة.' }, { status: 404 });
    deleteRelationship(Number(id), actor);
    const result = recalculateSchedule(before.schedule_id);
    return NextResponse.json({ success: true, recalc: result });
  } catch (err) {
    return handlePmError(err);
  }
}
