import { NextResponse } from 'next/server';
import { closePermit, cancelPermit } from '@/lib/hse/db/permits.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'hse_permit', 'edit');
    const permit = body.cancel ? cancelPermit(Number(id), actor) : closePermit(Number(id), body, actor);
    return NextResponse.json({ success: true, permit });
  } catch (err) {
    return handleHseError(err);
  }
}
