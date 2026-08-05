// lib/hse/db/hazmat.js
// المواد الخطرة (الوثيقة الأولى، قسم "إدارة المواد الخطرة"). بطاقة SDS نفسها ملف حقيقي عبر
// hse_attachments (entity_type='hazmat') - sds_attachment_id يشير لسجل مرفق فعلي، وليس رابطاً وهمياً.
import { randomUUID } from 'crypto';
import { hdb } from '../schema.js';
import { writeHseAudit } from './audit.js';
import { ValidationError } from '../../calc/common.js';

function validateHazmat(data) {
  const errors = [];
  if (!data.material_name || !data.material_name.trim()) errors.push('اسم المادة مطلوب.');
  if (errors.length) throw new ValidationError(errors);
}

export function createHazmatMaterial(data, actor) {
  validateHazmat(data);
  const db = hdb();
  const uuid = randomUUID();
  const info = db.prepare(
    `INSERT INTO hse_hazmat_materials (uuid, project_id, material_name, category, storage_location, transport_method,
       usage_instructions, required_ppe, emergency_procedures, disposal_method, quantity_on_hand, unit)
     VALUES (@uuid, @project_id, @material_name, @category, @storage_location, @transport_method,
       @usage_instructions, @required_ppe, @emergency_procedures, @disposal_method, @quantity_on_hand, @unit)`
  ).run({
    uuid, project_id: data.project_id || null, material_name: data.material_name.trim(), category: data.category || 'other',
    storage_location: data.storage_location || null, transport_method: data.transport_method || null,
    usage_instructions: data.usage_instructions || null, required_ppe: data.required_ppe || null,
    emergency_procedures: data.emergency_procedures || null, disposal_method: data.disposal_method || null,
    quantity_on_hand: data.quantity_on_hand ?? null, unit: data.unit || null,
  });
  const created = getHazmatById(info.lastInsertRowid);
  writeHseAudit(db, { project_id: data.project_id || null, entity_type: 'hazmat', entity_id: created.id, action: 'create', before: null, after: created, actor });
  return created;
}

export function getHazmatById(id) {
  return hdb().prepare(`SELECT * FROM hse_hazmat_materials WHERE id = ?`).get(id);
}

export function listHazmatMaterials({ project_id, category, includeArchived = false } = {}) {
  const db = hdb();
  let where = includeArchived ? ' WHERE 1=1' : ' WHERE is_archived = 0';
  const params = {};
  if (project_id) { where += ' AND (project_id = @project_id OR project_id IS NULL)'; params.project_id = project_id; }
  if (category) { where += ' AND category = @category'; params.category = category; }
  return hdb().prepare(`SELECT * FROM hse_hazmat_materials${where} ORDER BY material_name ASC`).all(params);
}

export function updateHazmatMaterial(id, data, actor) {
  const db = hdb();
  const run = db.transaction(() => {
    const before = getHazmatById(id);
    if (!before) throw new ValidationError('المادة الخطرة غير موجودة.');
    const merged = { ...before, ...data };
    validateHazmat(merged);
    db.prepare(
      `UPDATE hse_hazmat_materials SET material_name=@material_name, category=@category, storage_location=@storage_location,
         transport_method=@transport_method, usage_instructions=@usage_instructions, required_ppe=@required_ppe,
         emergency_procedures=@emergency_procedures, disposal_method=@disposal_method, quantity_on_hand=@quantity_on_hand,
         unit=@unit, sds_attachment_id=@sds_attachment_id, updated_at=datetime('now') WHERE id=@id`
    ).run({ id, material_name: merged.material_name, category: merged.category, storage_location: merged.storage_location,
      transport_method: merged.transport_method, usage_instructions: merged.usage_instructions, required_ppe: merged.required_ppe,
      emergency_procedures: merged.emergency_procedures, disposal_method: merged.disposal_method,
      quantity_on_hand: merged.quantity_on_hand, unit: merged.unit, sds_attachment_id: merged.sds_attachment_id || null });
    const after = getHazmatById(id);
    writeHseAudit(db, { project_id: after.project_id, entity_type: 'hazmat', entity_id: id, action: 'update', before, after, actor });
    return after;
  });
  return run();
}

export function archiveHazmatMaterial(id, actor) {
  const db = hdb();
  const before = getHazmatById(id);
  if (!before) throw new ValidationError('المادة الخطرة غير موجودة.');
  db.prepare(`UPDATE hse_hazmat_materials SET is_archived = 1, updated_at = datetime('now') WHERE id = ?`).run(id);
  writeHseAudit(db, { project_id: before.project_id, entity_type: 'hazmat', entity_id: id, action: 'archive', before, after: null, actor });
  return getHazmatById(id);
}
