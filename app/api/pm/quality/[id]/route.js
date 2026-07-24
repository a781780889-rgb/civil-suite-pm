import { NextResponse } from 'next/server';
import { updateQualityRecord, deleteQualityRecord } from '@/lib/pm/db/quality.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'quality', 'edit');
    const record = updateQualityRecord(Number(id), { ...body, actor });
    return NextResponse.json({ success: true, record });
  } catch (err) {
    return handlePmError(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'quality', 'delete');
    const result = deleteQualityRecord(Number(id), actor);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return handlePmError(err);
  }
}
