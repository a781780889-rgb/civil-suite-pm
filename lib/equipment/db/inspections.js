// lib/equipment/db/inspections.js
// فحوصات السلامة (البند 15) - مرتبطة بصلاحية وحدة 'safety' الموجودة أصلاً (ربط حقيقي بقسم
// السلامة المهنية بدل تكرار نظام صلاحيات). فشل الفحص يوقف المعدة فعلياً حتى اعتماد صريح
// لإعادة التشغيل ("لا يُسمح بتشغيل معدة خارج الخدمة لأسباب سلامة إلا بعد اعتماد إعادة التشغيل").
import { randomUUID } from 'crypto';
import { edb, INSPECTION_TYPES, INSPECTION_RESULTS } from '../schema.js';
import { ValidationError } from '../../calc/common.js';
import { writeAudit } from './audit.js';
import { getEquipmentById, changeEquipmentStatus } from './equipment.js';

export function createInspection(data, actor) {
  if (!data.equipment_id || !data.inspection_date) {
    throw new ValidationError('بيانات الفحص غير مكتملة.', ['المعدة وتاريخ الفحص كلاهما مطلوب.']);
  }
  if (data.result && !INSPECTION_RESULTS.includes(data.result)) {
    throw new ValidationError('نتيجة فحص غير صالحة.', [`القيم المسموحة: ${INSPECTION_RESULTS.join('، ')}.`]);
  }
  const db = edb();
  const equipment = getEquipmentById(data.equipment_id);
  if (!equipment) throw new Error('المعدة غير موجودة.');
  const uuid = randomUUID();
  const result = data.result || 'pass';
  const info = db.prepare(`
    INSERT INTO equipment_inspections (uuid, equipment_id, inspection_type, checklist_json, defects_found, inspector, inspection_date, result, notes, actor)
    VALUES (@uuid, @equipment_id, @inspection_type, @checklist_json, @defects_found, @inspector, @inspection_date, @result, @notes, @actor)
  `).run({
    uuid, equipment_id: data.equipment_id,
    inspection_type: data.inspection_type && INSPECTION_TYPES.includes(data.inspection_type) ? data.inspection_type : 'pre_operation',
    checklist_json: JSON.stringify(data.checklist || []), defects_found: data.defects_found || null,
    inspector: data.inspector || null, inspection_date: data.inspection_date, result, notes: data.notes || null, actor: actor || null,
  });
  const inspection = db.prepare(`SELECT * FROM equipment_inspections WHERE id = ?`).get(info.lastInsertRowid);

  if (result === 'fail') {
    changeEquipmentStatus(data.equipment_id, 'out_of_service', `فشل فحص سلامة (${data.inspection_type || 'pre_operation'}): ${data.defects_found || ''}`, actor);
  }

  writeAudit({ equipment_id: data.equipment_id, entity_type: 'inspection', entity_id: inspection.id, action: 'create', after: inspection, actor });
  return { ...inspection, checklist: JSON.parse(inspection.checklist_json || '[]') };
}

/** اعتماد إعادة تشغيل معدة أُخرجت من الخدمة لسبب سلامة - يتطلب صلاحية اعتماد على وحدة 'safety' (تُفحص في مسار الـ API). */
export function approveReturnToService(equipmentId, note, actor) {
  return changeEquipmentStatus(equipmentId, 'available', `اعتماد إعادة التشغيل بعد فحص سلامة: ${note || ''}`, actor);
}

export function listInspections({ equipment_id, result, page = 1, pageSize = 20 } = {}) {
  const db = edb();
  const where = [];
  const params = {};
  if (equipment_id) { where.push('equipment_id = @equipment_id'); params.equipment_id = equipment_id; }
  if (result) { where.push('result = @result'); params.result = result; }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS n FROM equipment_inspections ${whereSql}`).get(params).n;
  const size = Math.min(200, Math.max(1, Number(pageSize) || 20));
  const offset = (Math.max(1, Number(page) || 1) - 1) * size;
  const rows = db.prepare(`SELECT * FROM equipment_inspections ${whereSql} ORDER BY inspection_date DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: size, offset }).map((r) => ({ ...r, checklist: JSON.parse(r.checklist_json || '[]') }));
  return { rows, total, page: Math.max(1, Number(page) || 1), pageSize: size };
}
