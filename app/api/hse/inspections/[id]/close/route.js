import { NextResponse } from 'next/server';
import { closeInspection } from '@/lib/hse/db/inspections.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { actor, actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_inspection', 'approve');
    const inspection = closeInspection(Number(id), actor);
    return NextResponse.json({ success: true, inspection });
  } catch (err) {
    return handleHseError(err);
  }
}
