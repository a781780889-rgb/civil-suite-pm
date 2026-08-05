import { NextResponse } from 'next/server';
import { getNearMissById, updateNearMiss } from '@/lib/hse/db/nearMisses.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_incident', 'view');
    const nearMiss = getNearMissById(Number(id));
    if (!nearMiss) return NextResponse.json({ success: false, error: 'البلاغ غير موجود.' }, { status: 404 });
    return NextResponse.json({ success: true, near_miss: nearMiss });
  } catch (err) {
    return handleHseError(err);
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'hse_incident', 'edit');
    const nearMiss = updateNearMiss(Number(id), body, actor);
    return NextResponse.json({ success: true, near_miss: nearMiss });
  } catch (err) {
    return handleHseError(err);
  }
}
