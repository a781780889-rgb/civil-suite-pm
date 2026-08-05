import { NextResponse } from 'next/server';
import { getCorrectiveActionById, updateCorrectiveActionProgress } from '@/lib/hse/db/correctiveActions.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_corrective_action', 'view');
    const action = getCorrectiveActionById(Number(id));
    if (!action) return NextResponse.json({ success: false, error: 'الإجراء التصحيحي غير موجود.' }, { status: 404 });
    return NextResponse.json({ success: true, action });
  } catch (err) {
    return handleHseError(err);
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'hse_corrective_action', 'edit');
    const action = updateCorrectiveActionProgress(Number(id), body, actor);
    return NextResponse.json({ success: true, action });
  } catch (err) {
    return handleHseError(err);
  }
}
