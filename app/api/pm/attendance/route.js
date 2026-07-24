import { NextResponse } from 'next/server';
import { listAttendance, upsertAttendance } from '@/lib/pm/db/team.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const result = listAttendance({
      team_member_id: searchParams.get('team_member_id') ? Number(searchParams.get('team_member_id')) : undefined,
      project_id: searchParams.get('project_id') ? Number(searchParams.get('project_id')) : undefined,
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
    });
    return NextResponse.json({ success: true, attendance: result });
  } catch (err) {
    return handlePmError(err);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { actor_role } = getActor(body, request);
    assertPermission(actor_role, 'team', 'edit');
    if (!body.team_member_id || !body.project_id || !body.date) {
      return NextResponse.json({ success: false, error: 'team_member_id وproject_id والتاريخ مطلوبة.' }, { status: 400 });
    }
    const record = upsertAttendance(body);
    return NextResponse.json({ success: true, record }, { status: 201 });
  } catch (err) {
    return handlePmError(err);
  }
}
