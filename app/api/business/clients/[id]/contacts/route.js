import { NextResponse } from 'next/server';
import { listClientContacts, createClientContact } from '@/lib/business/db/clients.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleBizError } from '@/lib/business/apiHelpers.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'biz_client', 'view');
    return NextResponse.json({ success: true, contacts: listClientContacts(id) });
  } catch (err) {
    return handleBizError(err);
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'biz_client', 'edit');
    const created = createClientContact(id, { ...body, actor });
    return NextResponse.json({ success: true, contact: created }, { status: 201 });
  } catch (err) {
    return handleBizError(err);
  }
}
