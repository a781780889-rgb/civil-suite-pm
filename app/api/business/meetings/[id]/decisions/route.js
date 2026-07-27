import { NextResponse } from 'next/server';
import { addMeetingDecision } from '@/lib/business/db/meetings.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleBizError } from '@/lib/business/apiHelpers.js';

/** create_task=true في الجسم + اجتماع مرتبط بمشروع ⇒ يُنشئ pm_task حقيقية (البند 12: ربط
 * المهام الناتجة بقسم إدارة المشاريع والجدول الزمني)، لذلك تتطلب صلاحية 'task' أيضاً عندئذٍ. */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'biz_meeting', 'edit');
    if (body.create_task) assertPermission(actor_role, 'task', 'create');
    const created = addMeetingDecision(id, { ...body, actor });
    return NextResponse.json({ success: true, decision: created }, { status: 201 });
  } catch (err) {
    return handleBizError(err);
  }
}
