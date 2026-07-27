import { NextResponse } from 'next/server';
import { listDocuments, createDocumentRecord } from '@/lib/business/db/documents.js';
import { saveBusinessFile } from '@/lib/business/fileStorage.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleBizError } from '@/lib/business/apiHelpers.js';

const ENTITY_TO_MODULE = {
  client: 'biz_client', opportunity: 'biz_opportunity', quote: 'biz_quote', contract: 'biz_contract',
  partner: 'biz_partner', work_order: 'biz_work_order', correspondence: 'biz_correspondence',
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const entity_type = searchParams.get('entity_type');
    const entity_id = searchParams.get('entity_id');
    if (!entity_type || !entity_id) return NextResponse.json({ success: false, error: 'entity_type وentity_id مطلوبان.' }, { status: 400 });
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, ENTITY_TO_MODULE[entity_type] || 'biz_client', 'view');
    return NextResponse.json({ success: true, documents: listDocuments({ entity_type, entity_id }) });
  } catch (err) {
    return handleBizError(err);
  }
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const entity_type = formData.get('entity_type');
    const entity_id = Number(formData.get('entity_id'));
    if (!file || !entity_type || !entity_id) return NextResponse.json({ success: false, error: 'file وentity_type وentity_id مطلوبة.' }, { status: 400 });
    const { actor, actor_role } = getActor({ actor: formData.get('actor'), actor_role: formData.get('actor_role') }, request);
    assertPermission(actor_role, ENTITY_TO_MODULE[entity_type] || 'biz_client', 'edit');
    const buffer = Buffer.from(await file.arrayBuffer());
    const relativePath = saveBusinessFile(entity_type, entity_id, file.name, buffer);
    const created = createDocumentRecord({
      entity_type, entity_id, project_id: formData.get('project_id') ? Number(formData.get('project_id')) : null,
      category: formData.get('category') || null, name: file.name, file_path: relativePath,
      file_size: buffer.length, mime_type: file.type || null, notes: formData.get('notes') || null, actor,
    });
    return NextResponse.json({ success: true, document: created }, { status: 201 });
  } catch (err) {
    return handleBizError(err);
  }
}
