import { NextResponse } from 'next/server';
import { getSafetyPlanDocument, deleteSafetyPlanDocument } from '@/lib/hse/db/safetyPlans.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'document', 'view');
    const document = getSafetyPlanDocument(Number(id));
    if (!document) return NextResponse.json({ success: false, error: 'المستند غير موجود.' }, { status: 404 });
    return NextResponse.json({ success: true, document });
  } catch (err) {
    return handleHseError(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const { actor, actor_role } = getActor(null, request);
    assertPermission(actor_role, 'document', 'delete');
    const result = deleteSafetyPlanDocument(Number(id), actor);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return handleHseError(err);
  }
}
