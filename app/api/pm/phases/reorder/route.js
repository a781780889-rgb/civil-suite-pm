import { NextResponse } from 'next/server';
import { reorderPhases } from '@/lib/pm/db/phases.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const { actor_role } = getActor(body, request);
    assertPermission(actor_role, 'phase', 'edit');
    if (!body.project_id || !Array.isArray(body.orderedIds)) {
      return NextResponse.json({ success: false, error: 'project_id ومصفوفة orderedIds مطلوبان.' }, { status: 400 });
    }
    const phases = reorderPhases(Number(body.project_id), body.orderedIds.map(Number));
    return NextResponse.json({ success: true, phases });
  } catch (err) {
    return handlePmError(err);
  }
}
