import { NextResponse } from 'next/server';
import { listDistributions, distributePpe } from '@/lib/hse/db/ppe.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError, pageParams } from '@/lib/hse/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_ppe', 'view');
    const data = listDistributions({
      project_id: searchParams.get('project_id') || undefined, employee_name: searchParams.get('employee_name') || undefined,
      status: searchParams.get('status') || undefined, ...pageParams(searchParams),
    });
    return NextResponse.json({ success: true, ...data });
  } catch (err) {
    return handleHseError(err);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'hse_ppe', 'create');
    const distribution = distributePpe(body, actor);
    return NextResponse.json({ success: true, distribution }, { status: 201 });
  } catch (err) {
    return handleHseError(err);
  }
}
