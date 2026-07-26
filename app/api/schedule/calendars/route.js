import { NextResponse } from 'next/server';
import { listCalendars, createCalendar } from '@/lib/schedule/db/calendars.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';
import { assertPermission } from '@/lib/pm/roles.js';

export async function GET(request) {
  try {
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'schedule', 'view');
    const { searchParams } = new URL(request.url);
    const project_id = searchParams.get('project_id') ? Number(searchParams.get('project_id')) : undefined;
    return NextResponse.json({ success: true, calendars: listCalendars(project_id) });
  } catch (err) {
    return handlePmError(err);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'schedule', 'edit');
    const calendar = createCalendar(body, actor);
    return NextResponse.json({ success: true, calendar });
  } catch (err) {
    return handlePmError(err);
  }
}
