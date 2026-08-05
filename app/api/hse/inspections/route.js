import { NextResponse } from 'next/server';
import { listInspections, createInspection } from '@/lib/hse/db/inspections.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError, pageParams } from '@/lib/hse/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_inspection', 'view');
    const data = listInspections({
      project_id: searchParams.get('project_id') || undefined, site_id: searchParams.get('site_id') || undefined,
      status: searchParams.get('status') || undefined, inspection_type: searchParams.get('inspection_type') || undefined,
      ...pageParams(searchParams),
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
    assertPermission(actor_role, 'hse_inspection', 'create');
    const inspection = createInspection(body, actor);
    return NextResponse.json({ success: true, inspection }, { status: 201 });
  } catch (err) {
    return handleHseError(err);
  }
}
