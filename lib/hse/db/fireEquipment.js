// lib/hse/db/fireEquipment.js
// معدات مكافحة الحريق (الوثيقة الأولى). كل فحص دوري حقيقي يُحدّث next_inspection_date تلقائياً
// من next_due_date الذي يُدخله الفاحص - وليس حسابياً ثابتاً بلا مدخلات فعلية.
import { randomUUID } from 'crypto';
import { hdb } from '../schema.js';
import { writeHseAudit } from './audit.js';
import { ValidationError } from '../../calc/common.js';

function validateFireEq(data) {
  const errors = [];
  if (!data.project_id) errors.push('المشروع مطلوب.');
  if (!data.equipment_type) errors.push('نوع المعدة مطلوب.');
  if (errors.length) throw new ValidationError(errors);
}

export function createFireEquipment(data, actor) {
  validateFireEq(data);
  const db = hdb();
  const uuid = randomUUID();
  const info = db.prepare(
    `INSERT INTO hse_fire_equipment (uuid, project_id, equipment_type, type_detail, location, install_date, last_inspection_date, next_inspection_date, expiry_date, status)
     VALUES (@uuid, @project_id, @equipment_type, @type_detail, @location, @install_date, @last_inspection_date, @next_inspection_date, @expiry_date, @status)`
  ).run({
    uuid, project_id: data.project_id, equipment_type: data.equipment_type, type_detail: data.type_detail || null,
    location: data.location || null, install_date: data.install_date || null, last_inspection_date: data.last_inspection_date || null,
    next_inspection_date: data.next_inspection_date || null, expiry_date: data.expiry_date || null, status: data.status || 'active',
  });
  const created = getFireEquipmentById(info.lastInsertRowid);
  writeHseAudit(db, { project_id: data.project_id, entity_type: 'fire_equipment', entity_id: created.id, action: 'create', before: null, after: created, actor });
  return created;
}

export function getFireEquipmentById(id) {
  return hdb().prepare(`SELECT * FROM hse_fire_equipment WHERE id = ?`).get(id);
}

export function listFireEquipment({ project_id, status, equipment_type, page = 1, pageSize = 20 } = {}) {
  const db = hdb();
  let where = ' WHERE 1=1';
  const params = {};
  if (project_id) { where += ' AND project_id = @project_id'; params.project_id = project_id; }
  if (status) { where += ' AND status = @status'; params.status = status; }
  if (equipment_type) { where += ' AND equipment_type = @equipment_type'; params.equipment_type = equipment_type; }
  const total = db.prepare(`SELECT COUNT(*) AS c FROM hse_fire_equipment${where}`).get(params).c;
  const offset = (page - 1) * pageSize;
  const rows = db.prepare(`SELECT * FROM hse_fire_equipment${where} ORDER BY next_inspection_date IS NULL, next_inspection_date ASC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: pageSize, offset });
  return { rows, total, page, pageSize };
}

/** تسجيل فحص دوري فعلي - يحدّث تواريخ آخر/التالي فحص على السجل الرئيسي من مدخلات الفاحص الحقيقية. */
export function recordFireEquipmentCheck(fireEquipmentId, { check_date, result, notes, inspected_by, next_due_date }, actor) {
  if (!check_date || !result) throw new ValidationError('تاريخ الفحص ونتيجته مطلوبان.');
  const db = hdb();
  const run = db.transaction(() => {
    const eq = getFireEquipmentById(fireEquipmentId);
    if (!eq) throw new ValidationError('معدة الإطفاء غير موجودة.');
    db.prepare(
      `INSERT INTO hse_fire_equipment_checks (fire_equipment_id, check_date, result, notes, inspected_by, next_due_date)
       VALUES (@fire_equipment_id, @check_date, @result, @notes, @inspected_by, @next_due_date)`
    ).run({ fire_equipment_id: fireEquipmentId, check_date, result, notes: notes || null, inspected_by: inspected_by || actor || null, next_due_date: next_due_date || null });
    const nextStatus = result === 'fail' ? 'needs_service' : 'active';
    db.prepare(
      `UPDATE hse_fire_equipment SET last_inspection_date=@check_date, next_inspection_date=@next_due_date, status=@status, updated_at=datetime('now') WHERE id=@id`
    ).run({ id: fireEquipmentId, check_date, next_due_date: next_due_date || eq.next_inspection_date, status: nextStatus });
    const after = getFireEquipmentById(fireEquipmentId);
    writeHseAudit(db, { project_id: after.project_id, entity_type: 'fire_equipment', entity_id: fireEquipmentId, action: 'check', before: eq, after, actor });
    return after;
  });
  return run();
}

export function listFireEquipmentChecks(fireEquipmentId) {
  return hdb().prepare(`SELECT * FROM hse_fire_equipment_checks WHERE fire_equipment_id = ? ORDER BY check_date DESC`).all(fireEquipmentId);
}
