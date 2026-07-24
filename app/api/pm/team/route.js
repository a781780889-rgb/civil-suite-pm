import { NextResponse } from 'next/server';
import { listTeamMembers, createTeamMember } from '@/lib/pm/db/team.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    if (!projectId) return NextResponse.json({ success: false, error: 'project_id مطلوب.' }, { status: 400 });
    return NextResponse.json({ success: true, team: listTeamMembers(Number(projectId)) });
  } catch (err) {
    return handlePmError(err);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'team', 'create');
    if (!body.project_id || !body.name || !body.role) return NextResponse.json({ success: false, error: 'project_id والاسم والدور مطلوبة.' }, { status: 400 });
    const member = createTeamMember({ ...body, actor });
    return NextResponse.json({ success: true, member }, { status: 201 });
  } catch (err) {
    return handlePmError(err);
  }
}
