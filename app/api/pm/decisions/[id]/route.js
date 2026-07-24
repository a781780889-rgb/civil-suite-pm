import { NextResponse } from 'next/server';
import { updateDecisionStatus, deleteDecision } from '@/lib/pm/db/meetings.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor_role } = getActor(body, request);
    assertPermission(actor_role, 'meeting', 'edit');
    if (!body.status) return NextResponse.json({ success: false, error: 'الحالة مطلوبة.' }, { status: 400 });
    const decision = updateDecisionStatus(Number(id), body.status);
    return NextResponse.json({ success: true, decision });
  } catch (err) {
    return handlePmError(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { actor_role } = getActor(body, request);
    assertPermission(actor_role, 'meeting', 'delete');
    const result = deleteDecision(Number(id));
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return handlePmError(err);
  }
}
