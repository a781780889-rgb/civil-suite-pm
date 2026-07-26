import { NextResponse } from 'next/server';
import { removeException } from '@/lib/schedule/db/calendars.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';
import { assertPermission } from '@/lib/pm/roles.js';

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const { actor, actor_role } = getActor({}, request);
    assertPermission(actor_role, 'schedule', 'edit');
    removeException(Number(id), actor);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handlePmError(err);
  }
}
