import { NextResponse } from 'next/server';
import { listNearMisses, createNearMiss } from '@/lib/hse/db/nearMisses.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError, pageParams } from '@/lib/hse/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_incident', 'view');
    const data = listNearMisses({
      project_id: searchParams.get('project_id') || undefined, site_id: searchParams.get('site_id') || undefined,
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
    assertPermission(actor_role, 'hse_incident', 'create');
    const nearMiss = createNearMiss(body, actor);
    return NextResponse.json({ success: true, near_miss: nearMiss }, { status: 201 });
  } catch (err) {
    return handleHseError(err);
  }
}
