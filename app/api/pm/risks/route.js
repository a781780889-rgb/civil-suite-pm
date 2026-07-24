import { NextResponse } from 'next/server';
import { listRisks, createRisk } from '@/lib/pm/db/risks.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    if (!projectId) return NextResponse.json({ success: false, error: 'project_id مطلوب.' }, { status: 400 });
    return NextResponse.json({ success: true, risks: listRisks({ project_id: Number(projectId), status: searchParams.get('status') || undefined }) });
  } catch (err) {
    return handlePmError(err);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'risk', 'create');
    if (!body.project_id || !body.title) return NextResponse.json({ success: false, error: 'project_id وعنوان الخطر مطلوبان.' }, { status: 400 });
    const risk = createRisk({ ...body, actor });
    return NextResponse.json({ success: true, risk }, { status: 201 });
  } catch (err) {
    return handlePmError(err);
  }
}
