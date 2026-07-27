import { NextResponse } from 'next/server';
import { updateClientContact, deleteClientContact } from '@/lib/business/db/clients.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleBizError } from '@/lib/business/apiHelpers.js';

export async function PATCH(request, { params }) {
  try {
    const { contactId } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'biz_client', 'edit');
    const updated = updateClientContact(contactId, { ...body, actor });
    return NextResponse.json({ success: true, contact: updated });
  } catch (err) {
    return handleBizError(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { contactId } = await params;
    const { actor, actor_role } = getActor({}, request);
    assertPermission(actor_role, 'biz_client', 'edit');
    const result = deleteClientContact(contactId, actor);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return handleBizError(err);
  }
}
