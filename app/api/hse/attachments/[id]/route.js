import { NextResponse } from 'next/server';
import { getAttachmentById, deleteAttachment } from '@/lib/hse/db/attachments.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const attachment = getAttachmentById(Number(id));
    if (!attachment) return NextResponse.json({ success: false, error: 'المرفق غير موجود.' }, { status: 404 });
    const { actor, actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_incident', 'delete');
    const result = deleteAttachment(Number(id), actor);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return handleHseError(err);
  }
}
