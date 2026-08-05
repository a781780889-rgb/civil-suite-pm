import { NextResponse } from 'next/server';
import { listViolations, createViolation } from '@/lib/hse/db/violations.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError, pageParams } from '@/lib/hse/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_inspection', 'view');
    const data = listViolations({
      project_id: searchParams.get('project_id') || undefined, site_id: searchParams.get('site_id') || undefined,
      status: searchParams.get('status') || undefined, severity: searchParams.get('severity') || undefined, ...pageParams(searchParams),
    });
    return NextResponse.json({ success: true, ...data });
  } catch (err) {
    return handleHseError(err);
  }
}

/** كل مخالفة تُنشئ إجراءً تصحيحياً مرتبطاً تلقائياً (انظر lib/hse/db/violations.js). */
export async function POST(request) {
  try {
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'hse_inspection', 'create');
    const violation = createViolation(body, actor);
    return NextResponse.json({ success: true, violation }, { status: 201 });
  } catch (err) {
    return handleHseError(err);
  }
}
