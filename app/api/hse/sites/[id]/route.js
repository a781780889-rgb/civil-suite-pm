import { NextResponse } from 'next/server';
import { getSiteWithStats, updateSite, deleteSite } from '@/lib/hse/db/sites.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_risk', 'view');
    const site = getSiteWithStats(Number(id));
    if (!site) return NextResponse.json({ success: false, error: 'الموقع غير موجود.' }, { status: 404 });
    return NextResponse.json({ success: true, site });
  } catch (err) {
    return handleHseError(err);
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'hse_risk', 'edit');
    const site = updateSite(Number(id), body, actor);
    return NextResponse.json({ success: true, site });
  } catch (err) {
    return handleHseError(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const { actor, actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_risk', 'delete');
    const result = deleteSite(Number(id), actor);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return handleHseError(err);
  }
}
