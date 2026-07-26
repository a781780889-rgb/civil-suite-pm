import { NextResponse } from 'next/server';
import { createRelationship } from '@/lib/schedule/db/relationships.js';
import { getActivity } from '@/lib/schedule/db/activities.js';
import { recalculateSchedule } from '@/lib/schedule/recalc.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';
import { assertPermission } from '@/lib/pm/roles.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'schedule', 'edit');
    const relationship = createRelationship(body, actor);
    const activity = getActivity(relationship.predecessor_id);
    const result = recalculateSchedule(activity.schedule_id);
    return NextResponse.json({ success: true, relationship, recalc: result });
  } catch (err) {
    return handlePmError(err);
  }
}
