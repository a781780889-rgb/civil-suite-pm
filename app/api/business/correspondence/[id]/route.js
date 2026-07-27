import { NextResponse } from 'next/server';
import { getCorrespondenceById, updateCorrespondence, deleteCorrespondence } from '@/lib/business/db/correspondence.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleBizError } from '@/lib/business/apiHelpers.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'biz_correspondence', 'view');
    const item = getCorrespondenceById(id);
    if (!item) return NextResponse.json({ success: false, error: 'المراسلة غير موجودة.' }, { status: 404 });
    return NextResponse.json({ success: true, correspondence: item });
  } catch (err) {
    return handleBizError(err);
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'biz_correspondence', 'edit');
    const updated = updateCorrespondence(id, { ...body, actor });
    return NextResponse.json({ success: true, correspondence: updated });
  } catch (err) {
    return handleBizError(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const { actor, actor_role } = getActor({}, request);
    assertPermission(actor_role, 'biz_correspondence', 'delete');
    const result = deleteCorrespondence(id, actor);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return handleBizError(err);
  }
}
