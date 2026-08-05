import { NextResponse } from 'next/server';
import { getRiskById, updateRisk, deleteRisk, listRiskReassessments } from '@/lib/hse/db/risks.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_risk', 'view');
    const risk = getRiskById(Number(id));
    if (!risk) return NextResponse.json({ success: false, error: 'الخطر غير موجود.' }, { status: 404 });
    return NextResponse.json({ success: true, risk, reassessments: listRiskReassessments(Number(id)) });
  } catch (err) {
    return handleHseError(err);
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'hse_risk', 'edit');
    const risk = updateRisk(Number(id), body, actor);
    return NextResponse.json({ success: true, risk });
  } catch (err) {
    return handleHseError(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const { actor, actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_risk', 'delete');
    const result = deleteRisk(Number(id), actor);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return handleHseError(err);
  }
}
