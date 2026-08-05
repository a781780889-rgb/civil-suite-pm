import { NextResponse } from 'next/server';
import { listSites, createSite } from '@/lib/hse/db/sites.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError, pageParams } from '@/lib/hse/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_risk', 'view');
    const data = listSites({
      project_id: searchParams.get('project_id') || undefined, site_status: searchParams.get('site_status') || undefined,
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
    assertPermission(actor_role, 'hse_risk', 'create');
    const site = createSite(body, actor);
    return NextResponse.json({ success: true, site }, { status: 201 });
  } catch (err) {
    return handleHseError(err);
  }
}
