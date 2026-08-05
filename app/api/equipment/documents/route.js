import { NextResponse } from 'next/server';
import { listDocuments, createDocumentRecord } from '@/lib/equipment/db/documents.js';
import { saveEquipmentFile } from '@/lib/equipment/fileStorage.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleEquipError } from '@/lib/equipment/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const equipment_id = searchParams.get('equipment_id');
    if (!equipment_id) return NextResponse.json({ success: false, error: 'equipment_id مطلوب.' }, { status: 400 });
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'equipment', 'view');
    return NextResponse.json({ success: true, documents: listDocuments(equipment_id) });
  } catch (err) {
    return handleEquipError(err);
  }
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const equipment_id = Number(formData.get('equipment_id'));
    if (!file || !equipment_id) return NextResponse.json({ success: false, error: 'file وequipment_id مطلوبان.' }, { status: 400 });
    const { actor, actor_role } = getActor({ actor: formData.get('actor'), actor_role: formData.get('actor_role') }, request);
    assertPermission(actor_role, 'equipment', 'edit');
    const buffer = Buffer.from(await file.arrayBuffer());
    const relativePath = saveEquipmentFile(equipment_id, file.name, buffer);
    const document = createDocumentRecord({
      equipment_id, doc_type: formData.get('doc_type') || 'other', file_path: relativePath,
      original_name: file.name, mime_type: file.type || null, size_bytes: buffer.length, uploaded_by: actor,
    });
    return NextResponse.json({ success: true, document }, { status: 201 });
  } catch (err) {
    return handleEquipError(err);
  }
}
