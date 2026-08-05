import { NextResponse } from 'next/server';
import { recordInspectionItemResult } from '@/lib/hse/db/inspections.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

export async function PATCH(request, { params }) {
  try {
    const { itemId } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'hse_inspection', 'edit');
    const item = recordInspectionItemResult(Number(itemId), body, actor);
    return NextResponse.json({ success: true, item });
  } catch (err) {
    return handleHseError(err);
  }
}
