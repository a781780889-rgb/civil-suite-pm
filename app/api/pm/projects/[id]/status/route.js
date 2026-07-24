import { NextResponse } from 'next/server';
import { changeProjectStatus } from '@/lib/pm/db/projects.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'project', 'approve');
    if (!body.status) return NextResponse.json({ success: false, error: 'الحالة الجديدة مطلوبة.' }, { status: 400 });
    const project = changeProjectStatus(Number(id), body.status, { note: body.note, actor });
    return NextResponse.json({ success: true, project });
  } catch (err) {
    return handlePmError(err);
  }
}
