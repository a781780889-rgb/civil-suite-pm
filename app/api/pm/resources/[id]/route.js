import { NextResponse } from 'next/server';
import { updateResource, deleteResource } from '@/lib/pm/db/resources.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor_role } = getActor(body, request);
    assertPermission(actor_role, 'resource', 'edit');
    const resource = updateResource(Number(id), body);
    return NextResponse.json({ success: true, resource });
  } catch (err) {
    return handlePmError(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { actor_role } = getActor(body, request);
    assertPermission(actor_role, 'resource', 'delete');
    const result = deleteResource(Number(id));
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return handlePmError(err);
  }
}
