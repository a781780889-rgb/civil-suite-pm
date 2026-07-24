import { NextResponse } from 'next/server';
import { listDocuments, createDocument } from '@/lib/pm/db/documents.js';
import { saveUploadedFile } from '@/lib/pm/fileStorage.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    if (!projectId) return NextResponse.json({ success: false, error: 'project_id مطلوب.' }, { status: 400 });
    const documents = listDocuments({ project_id: Number(projectId), category: searchParams.get('category') || undefined, status: searchParams.get('status') || undefined });
    return NextResponse.json({ success: true, documents });
  } catch (err) {
    return handlePmError(err);
  }
}

/** يستقبل multipart/form-data حقيقياً (حقل file + project_id + category + name) ويحفظ الملف فعلياً على القرص. */
export async function POST(request) {
  try {
    const form = await request.formData();
    const file = form.get('file');
    const project_id = Number(form.get('project_id'));
    const actor = form.get('actor') || null;
    const actor_role = form.get('actor_role') || 'project_manager';
    assertPermission(actor_role, 'document', 'create');
    if (!file || typeof file === 'string') return NextResponse.json({ success: false, error: 'الملف مطلوب (حقل file).' }, { status: 400 });
    if (!project_id) return NextResponse.json({ success: false, error: 'project_id مطلوب.' }, { status: 400 });

    const saved = await saveUploadedFile(project_id, file);
    const document = createDocument({
      project_id,
      category: form.get('category') || null,
      name: form.get('name') || saved.originalName,
      file_path: saved.relativePath,
      file_size: saved.size,
      mime_type: saved.mimeType,
      uploaded_by: actor,
      notes: form.get('notes') || null,
      actor,
    });
    return NextResponse.json({ success: true, document }, { status: 201 });
  } catch (err) {
    return handlePmError(err);
  }
}
