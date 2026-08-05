import { NextResponse } from 'next/server';
import { listFireEquipment, createFireEquipment } from '@/lib/hse/db/fireEquipment.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError, pageParams } from '@/lib/hse/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_emergency', 'view');
    const data = listFireEquipment({
      project_id: searchParams.get('project_id') || undefined, status: searchParams.get('status') || undefined,
      equipment_type: searchParams.get('equipment_type') || undefined, ...pageParams(searchParams),
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
    assertPermission(actor_role, 'hse_emergency', 'create');
    const equipment = createFireEquipment(body, actor);
    return NextResponse.json({ success: true, equipment }, { status: 201 });
  } catch (err) {
    return handleHseError(err);
  }
}
