import { NextResponse } from 'next/server';
import { listHazmatMaterials, createHazmatMaterial } from '@/lib/hse/db/hazmat.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_hazmat', 'view');
    const materials = listHazmatMaterials({
      project_id: searchParams.get('project_id') || undefined, category: searchParams.get('category') || undefined,
      includeArchived: searchParams.get('includeArchived') === 'true',
    });
    return NextResponse.json({ success: true, materials });
  } catch (err) {
    return handleHseError(err);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'hse_hazmat', 'create');
    const material = createHazmatMaterial(body, actor);
    return NextResponse.json({ success: true, material }, { status: 201 });
  } catch (err) {
    return handleHseError(err);
  }
}
