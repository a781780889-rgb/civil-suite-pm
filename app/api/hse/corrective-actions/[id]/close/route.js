import { NextResponse } from 'next/server';
import { approveAndCloseCorrectiveAction } from '@/lib/hse/db/correctiveActions.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

/** "لا تعتبر الملاحظة مغلقة إلا بعد اعتماد المسؤول" (البند 12 حرفياً) - approve فقط، بلا edit. */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'hse_corrective_action', 'approve');
    const action = approveAndCloseCorrectiveAction(Number(id), body, actor);
    return NextResponse.json({ success: true, action });
  } catch (err) {
    return handleHseError(err);
  }
}
