import { NextResponse } from 'next/server';
import { listEmergencyDrills, recordEmergencyDrill } from '@/lib/hse/db/emergency.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_emergency', 'view');
    const project_id = searchParams.get('project_id');
    if (!project_id) return NextResponse.json({ success: false, error: 'project_id مطلوب.' }, { status: 400 });
    const drills = listEmergencyDrills(Number(project_id));
    return NextResponse.json({ success: true, drills });
  } catch (err) {
    return handleHseError(err);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'hse_emergency', 'create');
    const drill = recordEmergencyDrill(body, actor);
    return NextResponse.json({ success: true, drill }, { status: 201 });
  } catch (err) {
    return handleHseError(err);
  }
}
