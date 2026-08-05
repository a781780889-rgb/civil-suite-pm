import { NextResponse } from 'next/server';
import { getDocumentById, deleteDocumentRecord } from '@/lib/equipment/db/documents.js';
import { readEquipmentFile } from '@/lib/equipment/fileStorage.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleEquipError } from '@/lib/equipment/apiHelpers.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'equipment', 'view');
    const doc = getDocumentById(id);
    if (!doc) return NextResponse.json({ success: false, error: 'المستند غير موجود.' }, { status: 404 });
    const buffer = readEquipmentFile(doc.file_path);
    return new NextResponse(buffer, {
      headers: { 'Content-Type': doc.mime_type || 'application/octet-stream', 'Content-Disposition': `inline; filename="${encodeURIComponent(doc.original_name || 'file')}"` },
    });
  } catch (err) {
    return handleEquipError(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const { actor, actor_role } = getActor(null, request);
    assertPermission(actor_role, 'equipment', 'delete');
    const result = deleteDocumentRecord(id, actor);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return handleEquipError(err);
  }
}
