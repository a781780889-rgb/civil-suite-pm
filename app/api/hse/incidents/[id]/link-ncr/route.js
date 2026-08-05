import { NextResponse } from 'next/server';
import { linkIncidentToQualityRecord } from '@/lib/hse/db/incidents.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { actor, actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_incident', 'edit');
    const incident = await linkIncidentToQualityRecord(Number(id), actor);
    return NextResponse.json({ success: true, incident });
  } catch (err) {
    return handleHseError(err);
  }
}
