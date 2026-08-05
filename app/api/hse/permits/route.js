import { NextResponse } from 'next/server';
import { listPermits, createPermit } from '@/lib/hse/db/permits.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError, pageParams } from '@/lib/hse/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_permit', 'view');
    const data = listPermits({
      project_id: searchParams.get('project_id') || undefined, site_id: searchParams.get('site_id') || undefined,
      status: searchParams.get('status') || undefined, permit_type: searchParams.get('permit_type') || undefined,
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
    assertPermission(actor_role, 'hse_permit', 'create');
    const permit = createPermit(body, actor);
    return NextResponse.json({ success: true, permit }, { status: 201 });
  } catch (err) {
    return handleHseError(err);
  }
}
