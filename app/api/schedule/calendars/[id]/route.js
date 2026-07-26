import { NextResponse } from 'next/server';
import { updateCalendar, listExceptions, addException } from '@/lib/schedule/db/calendars.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';
import { assertPermission } from '@/lib/pm/roles.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'schedule', 'view');
    return NextResponse.json({ success: true, exceptions: listExceptions(Number(id)) });
  } catch (err) {
    return handlePmError(err);
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'schedule', 'edit');
    const calendar = updateCalendar(Number(id), body, actor);
    return NextResponse.json({ success: true, calendar });
  } catch (err) {
    return handlePmError(err);
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'schedule', 'edit');
    const exception = addException(Number(id), body, actor);
    return NextResponse.json({ success: true, exception });
  } catch (err) {
    return handlePmError(err);
  }
}
