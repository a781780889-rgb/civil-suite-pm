import { NextResponse } from 'next/server';
import { getCommitmentById, updateCommitment, deleteCommitment } from '@/lib/business/db/commitments.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleBizError } from '@/lib/business/apiHelpers.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'biz_commitment', 'view');
    const item = getCommitmentById(id);
    if (!item) return NextResponse.json({ success: false, error: 'الالتزام غير موجود.' }, { status: 404 });
    return NextResponse.json({ success: true, commitment: item });
  } catch (err) {
    return handleBizError(err);
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'biz_commitment', 'edit');
    const updated = updateCommitment(id, { ...body, actor });
    return NextResponse.json({ success: true, commitment: updated });
  } catch (err) {
    return handleBizError(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const { actor, actor_role } = getActor({}, request);
    assertPermission(actor_role, 'biz_commitment', 'delete');
    const result = deleteCommitment(id, actor);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return handleBizError(err);
  }
}
