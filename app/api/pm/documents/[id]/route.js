import { NextResponse } from 'next/server';
import { getDocument, listDocumentVersions, updateDocumentMeta, deleteDocument } from '@/lib/pm/db/documents.js';
import { deleteFile } from '@/lib/pm/fileStorage.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';

export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    const document = getDocument(Number(id));
    if (!document) return NextResponse.json({ success: false, error: 'المستند غير موجود.' }, { status: 404 });
    return NextResponse.json({ success: true, document, versions: listDocumentVersions(Number(id)) });
  } catch (err) {
    return handlePmError(err);
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'document', 'edit');
    const document = updateDocumentMeta(Number(id), { ...body, actor });
    return NextResponse.json({ success: true, document });
  } catch (err) {
    return handlePmError(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'document', 'delete');
    const result = deleteDocument(Number(id), actor);
    if (result.deleted) {
      for (const filePath of result.filePaths) deleteFile(filePath); // حذف فعلي للملفات من القرص، وليس فقط سجل قاعدة البيانات
    }
    return NextResponse.json({ success: true, deleted: result.deleted });
  } catch (err) {
    return handlePmError(err);
  }
}
