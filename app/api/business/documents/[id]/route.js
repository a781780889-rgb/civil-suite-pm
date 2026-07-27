import { NextResponse } from 'next/server';
import { getDocumentById, deleteDocument } from '@/lib/business/db/documents.js';
import { readBusinessFile } from '@/lib/business/fileStorage.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleBizError } from '@/lib/business/apiHelpers.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'document', 'view');
    const doc = getDocumentById(id);
    if (!doc) return NextResponse.json({ success: false, error: 'المستند غير موجود.' }, { status: 404 });
    const buffer = readBusinessFile(doc.file_path);
    return new NextResponse(buffer, {
      headers: { 'Content-Type': doc.mime_type || 'application/octet-stream', 'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.name)}"` },
    });
  } catch (err) {
    return handleBizError(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const { actor, actor_role } = getActor({}, request);
    assertPermission(actor_role, 'document', 'delete');
    const result = deleteDocument(id, actor);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return handleBizError(err);
  }
}
