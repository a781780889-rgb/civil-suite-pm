import { NextResponse } from 'next/server';
import { getHazmatById, updateHazmatMaterial, archiveHazmatMaterial } from '@/lib/hse/db/hazmat.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_hazmat', 'view');
    const material = getHazmatById(Number(id));
    if (!material) return NextResponse.json({ success: false, error: 'المادة الخطرة غير موجودة.' }, { status: 404 });
    return NextResponse.json({ success: true, material });
  } catch (err) {
    return handleHseError(err);
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'hse_hazmat', 'edit');
    const material = updateHazmatMaterial(Number(id), body, actor);
    return NextResponse.json({ success: true, material });
  } catch (err) {
    return handleHseError(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const { actor, actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_hazmat', 'delete');
    const material = archiveHazmatMaterial(Number(id), actor);
    return NextResponse.json({ success: true, material });
  } catch (err) {
    return handleHseError(err);
  }
}
