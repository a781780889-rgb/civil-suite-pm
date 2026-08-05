import { NextResponse } from 'next/server';
import { closeIncident } from '@/lib/hse/db/incidents.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'hse_incident', 'approve');
    const incident = closeIncident(Number(id), body, actor);
    return NextResponse.json({ success: true, incident });
  } catch (err) {
    return handleHseError(err);
  }
}
