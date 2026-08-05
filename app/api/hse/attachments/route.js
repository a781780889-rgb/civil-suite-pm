import { NextResponse } from 'next/server';
import { addAttachment, listAttachments } from '@/lib/hse/db/attachments.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

const ENTITY_MODULE_MAP = {
  incident: 'hse_incident', near_miss: 'hse_incident', inspection: 'hse_inspection', violation: 'hse_inspection',
  permit: 'hse_permit', hazmat: 'hse_hazmat', risk: 'hse_risk',
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const entity_type = searchParams.get('entity_type');
    const entity_id = searchParams.get('entity_id');
    if (!entity_type || !entity_id) return NextResponse.json({ success: false, error: 'entity_type وentity_id مطلوبان.' }, { status: 400 });
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, ENTITY_MODULE_MAP[entity_type] || 'hse_risk', 'view');
    const attachments = listAttachments(entity_type, Number(entity_id));
    return NextResponse.json({ success: true, attachments });
  } catch (err) {
    return handleHseError(err);
  }
}

/** يستقبل multipart/form-data حقيقياً (حقل file + project_id + entity_type + entity_id) ويحفظ
 * الملف فعلياً على القرص عبر lib/pm/fileStorage.js المُعاد استخدامه - نفس نمط مسار المستندات. */
export async function POST(request) {
  try {
    const form = await request.formData();
    const entity_type = form.get('entity_type');
    const entity_id = Number(form.get('entity_id'));
    const project_id = Number(form.get('project_id'));
    const actor = form.get('actor') || null;
    const actor_role = form.get('actor_role') || 'hse_manager';
    assertPermission(actor_role, ENTITY_MODULE_MAP[entity_type] || 'hse_risk', 'edit');
    const file = form.get('file');
    const attachment = await addAttachment({ project_id, entity_type, entity_id, file, uploaded_by: actor }, actor);
    return NextResponse.json({ success: true, attachment }, { status: 201 });
  } catch (err) {
    return handleHseError(err);
  }
}
