import { NextResponse } from 'next/server';
import { listDecisions, addDecision } from '@/lib/pm/db/meetings.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';

export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    return NextResponse.json({ success: true, decisions: listDecisions(Number(id)) });
  } catch (err) {
    return handlePmError(err);
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'meeting', 'edit');
    if (!body.decision_text) return NextResponse.json({ success: false, error: 'نص القرار مطلوب.' }, { status: 400 });
    if (body.generateTask) assertPermission(actor_role, 'task', 'create');
    const decision = addDecision({ meeting_id: Number(id), decision_text: body.decision_text, responsible: body.responsible, due_date: body.due_date, generateTask: !!body.generateTask, project_id: body.project_id, actor });
    return NextResponse.json({ success: true, decision }, { status: 201 });
  } catch (err) {
    return handlePmError(err);
  }
}
