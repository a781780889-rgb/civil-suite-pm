import { NextResponse } from 'next/server';
import { getPermitWithApprovals, updatePermit } from '@/lib/hse/db/permits.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_permit', 'view');
    const permit = getPermitWithApprovals(Number(id));
    if (!permit) return NextResponse.json({ success: false, error: 'التصريح غير موجود.' }, { status: 404 });
    return NextResponse.json({ success: true, permit });
  } catch (err) {
    return handleHseError(err);
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'hse_permit', 'edit');
    const permit = updatePermit(Number(id), body, actor);
    return NextResponse.json({ success: true, permit });
  } catch (err) {
    return handleHseError(err);
  }
}
