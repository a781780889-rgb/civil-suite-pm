import { NextResponse } from 'next/server';
import { getInspectionWithItems } from '@/lib/hse/db/inspections.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_inspection', 'view');
    const inspection = getInspectionWithItems(Number(id));
    if (!inspection) return NextResponse.json({ success: false, error: 'التفتيش غير موجود.' }, { status: 404 });
    return NextResponse.json({ success: true, inspection });
  } catch (err) {
    return handleHseError(err);
  }
}
