import { NextResponse } from 'next/server';
import { comparePlannedVsActual } from '@/lib/schedule/db/progress.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';
import { assertPermission } from '@/lib/pm/roles.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'schedule', 'view');
    return NextResponse.json({ success: true, comparison: comparePlannedVsActual(Number(id)) });
  } catch (err) {
    return handlePmError(err);
  }
}
