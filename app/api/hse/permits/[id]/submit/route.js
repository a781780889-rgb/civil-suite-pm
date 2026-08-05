import { NextResponse } from 'next/server';
import { submitPermitForApproval } from '@/lib/hse/db/permits.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { actor, actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_permit', 'edit');
    const permit = submitPermitForApproval(Number(id), actor, actor_role);
    return NextResponse.json({ success: true, permit });
  } catch (err) {
    return handleHseError(err);
  }
}
