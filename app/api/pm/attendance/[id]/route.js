import { NextResponse } from 'next/server';
import { deleteAttendance } from '@/lib/pm/db/team.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { actor_role } = getActor(body, request);
    assertPermission(actor_role, 'team', 'edit');
    const result = deleteAttendance(Number(id));
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return handlePmError(err);
  }
}
