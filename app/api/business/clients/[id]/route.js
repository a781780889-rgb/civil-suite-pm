import { NextResponse } from 'next/server';
import { getClientById, updateClient, setClientStatus, hardDeleteClient, getClientFullHistory, findDuplicateClient } from '@/lib/business/db/clients.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleBizError } from '@/lib/business/apiHelpers.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'biz_client', 'view');
    const client = getClientById(id);
    if (!client) return NextResponse.json({ success: false, error: 'العميل غير موجود.' }, { status: 404 });
    client.history = getClientFullHistory(id);
    return NextResponse.json({ success: true, client });
  } catch (err) {
    return handleBizError(err);
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    if (body.status && Object.keys(body).length <= 2) {
      assertPermission(actor_role, 'biz_client', 'edit');
      const updated = setClientStatus(id, body.status, actor);
      return NextResponse.json({ success: true, client: updated });
    }
    assertPermission(actor_role, 'biz_client', 'edit');
    const dup = findDuplicateClient(body, Number(id));
    if (dup) return NextResponse.json({ success: false, error: `عميل مطابق آخر موجود بالفعل: "${dup.name}" (#${dup.id}).`, duplicateOf: dup }, { status: 409 });
    const updated = updateClient(id, { ...body, actor });
    return NextResponse.json({ success: true, client: updated });
  } catch (err) {
    return handleBizError(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const { actor, actor_role } = getActor({}, request);
    assertPermission(actor_role, 'biz_client', 'delete');
    const result = hardDeleteClient(id, actor);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return handleBizError(err);
  }
}
