import { NextResponse } from 'next/server';
import { addDocumentVersion, getDocument } from '@/lib/pm/db/documents.js';
import { saveUploadedFile } from '@/lib/pm/fileStorage.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { handlePmError } from '@/lib/pm/apiHelpers.js';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const form = await request.formData();
    const file = form.get('file');
    const actor = form.get('actor') || null;
    const actor_role = form.get('actor_role') || 'project_manager';
    assertPermission(actor_role, 'document', 'edit');
    if (!file || typeof file === 'string') return NextResponse.json({ success: false, error: 'الملف مطلوب (حقل file).' }, { status: 400 });

    const existing = getDocument(Number(id));
    if (!existing) return NextResponse.json({ success: false, error: 'المستند غير موجود.' }, { status: 404 });

    const saved = await saveUploadedFile(existing.project_id, file);
    const document = addDocumentVersion(Number(id), {
      file_path: saved.relativePath, file_size: saved.size, uploaded_by: actor, notes: form.get('notes') || null, actor,
    });
    return NextResponse.json({ success: true, document }, { status: 201 });
  } catch (err) {
    return handlePmError(err);
  }
}
