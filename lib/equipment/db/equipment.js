// lib/equipment/db/equipment.js
// السجل الرئيسي للمعدات (equipment_assets) - البند 2 من القواعد الإلزامية. CRUD كامل +
// تغيير الحالة/الموقع مع تسجيل تلقائي في equipment_status_log وequipment_audit_log (البند 25).
import { randomUUID } from 'crypto';
import { edb, EQUIPMENT_STATUSES, OWNERSHIP_TYPES } from '../schema.js';
import { ValidationError } from '../../calc/common.js';
import { writeAudit } from './audit.js';

const WRITABLE_FIELDS = [
  'equipment_code', 'name', 'category_key', 'manufacturer', 'model', 'manufacture_year',
  'serial_number', 'chassis_number', 'engine_number', 'plate_number', 'color', 'weight_kg',
  'capacity_value', 'capacity_unit', 'operating_power', 'tank_capacity_l', 'fuel_type',
  'rated_consumption_l_per_hour', 'ownership_type', 'current_location', 'current_project_id',
  'responsible_person', 'purchase_date', 'purchase_price', 'useful_life_years', 'salvage_value',
  'warranty_expiry', 'insurance_provider', 'insurance_policy_no', 'insurance_expiry',
  'photo_base64', 'notes',
];

function nextEquipmentCode(db) {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM equipment_assets`).get();
  const seq = String((row?.n || 0) + 1).padStart(5, '0');
  return `EQ-${seq}`;
}

function validate(data, { partial = false } = {}) {
  const messages = [];
  if (!partial && !data.name) messages.push('اسم المعدة مطلوب.');
  if (!partial && !data.category_key) messages.push('تصنيف المعدة مطلوب.');
  if (data.ownership_type && !OWNERSHIP_TYPES.includes(data.ownership_type)) {
    messages.push(`نوع الملكية غير صالح. القيم المسموحة: ${OWNERSHIP_TYPES.join('، ')}.`);
  }
  if (data.status && !EQUIPMENT_STATUSES.includes(data.status)) {
    messages.push(`حالة المعدة غير صالحة. القيم المسموحة: ${EQUIPMENT_STATUSES.join('، ')}.`);
  }
  if (data.purchase_price != null && Number(data.purchase_price) < 0) messages.push('سعر الشراء لا يمكن أن يكون سالباً.');
  if (data.weight_kg != null && Number(data.weight_kg) < 0) messages.push('الوزن لا يمكن أن يكون سالباً.');
  if (messages.length) throw new ValidationError('بيانات المعدة غير صالحة.', messages);
}

function withJoins() {
  return `
    SELECT ea.*, ec.name_ar AS category_name, ec.group_key AS category_group,
           p.name AS project_name
    FROM equipment_assets ea
    LEFT JOIN equipment_categories ec ON ec.key = ea.category_key
    LEFT JOIN projects p ON p.id = ea.current_project_id
  `;
}

export function createEquipment(data, actor) {
  validate(data);
  const db = edb();
  const uuid = randomUUID();
  const code = data.equipment_code?.trim() || nextEquipmentCode(db);
  const existing = db.prepare(`SELECT id FROM equipment_assets WHERE equipment_code = ?`).get(code);
  if (existing) throw new ValidationError('رقم المعدة مستخدم مسبقاً.', [`رقم المعدة "${code}" موجود بالفعل.`]);

  const cols = ['uuid', 'equipment_code', 'status', ...WRITABLE_FIELDS.filter((f) => f !== 'equipment_code')];
  const values = {
    uuid, equipment_code: code, status: data.status && EQUIPMENT_STATUSES.includes(data.status) ? data.status : 'available',
  };
  for (const f of WRITABLE_FIELDS) { if (f === 'equipment_code') continue; values[f] = data[f] ?? null; }

  const placeholders = cols.map((c) => `@${c}`).join(', ');
  const info = db.prepare(`INSERT INTO equipment_assets (${cols.join(', ')}) VALUES (${placeholders})`).run(values);
  const id = info.lastInsertRowid;

  db.prepare(`
    INSERT INTO equipment_status_log (equipment_id, old_status, new_status, old_location, new_location, old_project_id, new_project_id, note, actor)
    VALUES (?, NULL, ?, NULL, ?, NULL, ?, 'إضافة معدة جديدة', ?)
  `).run(id, values.status, values.current_location || null, values.current_project_id || null, actor || null);

  writeAudit({ equipment_id: id, entity_type: 'equipment', entity_id: id, action: 'create', before: null, after: values, actor });
  return getEquipmentById(id);
}

export function listEquipment({ page = 1, pageSize = 20, status, category_key, group_key, project_id, ownership_type, search, includeArchived = false } = {}) {
  const db = edb();
  const where = [];
  const params = {};
  if (!includeArchived) where.push('ea.is_archived = 0');
  if (status) { where.push('ea.status = @status'); params.status = status; }
  if (category_key) { where.push('ea.category_key = @category_key'); params.category_key = category_key; }
  if (group_key) { where.push('ec.group_key = @group_key'); params.group_key = group_key; }
  if (project_id) { where.push('ea.current_project_id = @project_id'); params.project_id = project_id; }
  if (ownership_type) { where.push('ea.ownership_type = @ownership_type'); params.ownership_type = ownership_type; }
  if (search) { where.push('(ea.name LIKE @search OR ea.equipment_code LIKE @search OR ea.serial_number LIKE @search OR ea.plate_number LIKE @search)'); params.search = `%${search}%`; }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = db.prepare(`SELECT COUNT(*) AS n FROM equipment_assets ea LEFT JOIN equipment_categories ec ON ec.key = ea.category_key ${whereSql}`).get(params).n;
  const pageNum = Math.max(1, Number(page) || 1);
  const size = Math.min(200, Math.max(1, Number(pageSize) || 20));
  const offset = (pageNum - 1) * size;
  const rows = db.prepare(`${withJoins()} ${whereSql} ORDER BY ea.created_at DESC LIMIT @limit OFFSET @offset`).all({ ...params, limit: size, offset });
  return { rows, total, page: pageNum, pageSize: size, totalPages: Math.max(1, Math.ceil(total / size)) };
}

export function getEquipmentById(id) {
  const db = edb();
  return db.prepare(`${withJoins()} WHERE ea.id = ?`).get(id) || null;
}

export function getEquipmentByUuid(uuid) {
  const db = edb();
  return db.prepare(`${withJoins()} WHERE ea.uuid = ?`).get(uuid) || null;
}

export function updateEquipment(id, data, actor) {
  const db = edb();
  const before = getEquipmentById(id);
  if (!before) throw new Error('المعدة غير موجودة.');
  validate(data, { partial: true });

  if (data.equipment_code && data.equipment_code !== before.equipment_code) {
    const dup = db.prepare(`SELECT id FROM equipment_assets WHERE equipment_code = ? AND id != ?`).get(data.equipment_code, id);
    if (dup) throw new ValidationError('رقم المعدة مستخدم مسبقاً.', [`رقم المعدة "${data.equipment_code}" موجود بالفعل.`]);
  }

  const fields = ['equipment_code', ...WRITABLE_FIELDS.filter((f) => f !== 'equipment_code')].filter((f) => f in data);
  if (!fields.length) return before;
  const setSql = fields.map((f) => `${f} = @${f}`).join(', ');
  const params = { id };
  for (const f of fields) params[f] = data[f] ?? null;
  db.prepare(`UPDATE equipment_assets SET ${setSql}, updated_at = datetime('now') WHERE id = @id`).run(params);

  const locationOrProjectChanged = ('current_location' in data && data.current_location !== before.current_location) ||
    ('current_project_id' in data && data.current_project_id !== before.current_project_id);
  if (locationOrProjectChanged) {
    db.prepare(`
      INSERT INTO equipment_status_log (equipment_id, old_status, new_status, old_location, new_location, old_project_id, new_project_id, note, actor)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'تحديث بيانات المعدة', ?)
    `).run(id, before.status, before.status, before.current_location, data.current_location ?? before.current_location,
      before.current_project_id, data.current_project_id ?? before.current_project_id, actor || null);
  }

  const after = getEquipmentById(id);
  writeAudit({ equipment_id: id, entity_type: 'equipment', entity_id: id, action: 'update', before, after, actor });
  return after;
}

/** تغيير حالة المعدة صراحة (متاحة/قيد التشغيل/صيانة/متوقفة/محجوزة/خارج الخدمة) - البند 4. */
export function changeEquipmentStatus(id, newStatus, note, actor) {
  if (!EQUIPMENT_STATUSES.includes(newStatus)) {
    throw new ValidationError('حالة غير صالحة.', [`الحالات المسموحة: ${EQUIPMENT_STATUSES.join('، ')}.`]);
  }
  const db = edb();
  const before = getEquipmentById(id);
  if (!before) throw new Error('المعدة غير موجودة.');

  db.prepare(`UPDATE equipment_assets SET status = @status, updated_at = datetime('now') WHERE id = @id`).run({ id, status: newStatus });
  db.prepare(`
    INSERT INTO equipment_status_log (equipment_id, old_status, new_status, old_location, new_location, old_project_id, new_project_id, note, actor)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, before.status, newStatus, before.current_location, before.current_location, before.current_project_id, before.current_project_id, note || null, actor || null);

  writeAudit({ equipment_id: id, entity_type: 'equipment', entity_id: id, action: 'status_change', before: { status: before.status }, after: { status: newStatus }, actor });
  return getEquipmentById(id);
}

/** أرشفة (حذف ناعم) - لا يحذف أي سجل تشغيلي مرتبط، فقط يستثني المعدة من القوائم النشطة (البند 28/29). */
export function archiveEquipment(id, actor) {
  const db = edb();
  const before = getEquipmentById(id);
  if (!before) throw new Error('المعدة غير موجودة.');
  db.prepare(`UPDATE equipment_assets SET is_archived = 1, status = 'archived', updated_at = datetime('now') WHERE id = ?`).run(id);
  db.prepare(`
    INSERT INTO equipment_status_log (equipment_id, old_status, new_status, old_location, new_location, old_project_id, new_project_id, note, actor)
    VALUES (?, ?, 'archived', ?, ?, ?, ?, 'أرشفة المعدة', ?)
  `).run(id, before.status, before.current_location, before.current_location, before.current_project_id, before.current_project_id, actor || null);
  writeAudit({ equipment_id: id, entity_type: 'equipment', entity_id: id, action: 'archive', before, after: null, actor });
  return getEquipmentById(id);
}

/**
 * حذف نهائي - مسموح فقط إذا لم يكن للمعدة أي سجل تشغيلي مرتبط (البند 28: "منع حذف السجلات
 * التشغيلية المهمة بشكل نهائي"). خلاف ذلك يجب استخدام الأرشفة. الصلاحية نفسها (full/delete)
 * تُفحص في مسار الـ API قبل استدعاء هذه الدالة.
 */
export function deleteEquipmentHard(id, actor) {
  const db = edb();
  const before = getEquipmentById(id);
  if (!before) throw new Error('المعدة غير موجودة.');
  const linkedTables = [
    'equipment_operation_logs', 'equipment_fuel_logs', 'equipment_maintenance_records',
    'equipment_breakdowns', 'equipment_assignments', 'equipment_reservations',
    'equipment_transfers', 'equipment_rentals', 'equipment_hour_meter_readings',
  ];
  for (const t of linkedTables) {
    const n = db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE equipment_id = ?`).get(id).n;
    if (n > 0) {
      throw new ValidationError(
        'لا يمكن الحذف النهائي لوجود سجلات تشغيلية مرتبطة بهذه المعدة.',
        [`يوجد ${n} سجل(ات) في ${t}. استخدم الأرشفة بدلاً من الحذف النهائي.`]
      );
    }
  }
  db.prepare(`DELETE FROM equipment_documents WHERE equipment_id = ?`).run(id);
  db.prepare(`DELETE FROM equipment_status_log WHERE equipment_id = ?`).run(id);
  db.prepare(`DELETE FROM equipment_operator_authorizations WHERE equipment_id = ?`).run(id);
  db.prepare(`DELETE FROM equipment_assets WHERE id = ?`).run(id);
  writeAudit({ equipment_id: id, entity_type: 'equipment', entity_id: id, action: 'hard_delete', before, after: null, actor });
  return { deleted: true };
}

export function updateHourMeterCache(id, value) {
  edb().prepare(`UPDATE equipment_assets SET current_hour_meter = @value, updated_at = datetime('now') WHERE id = @id`).run({ id, value });
}

/**
 * تُستدعى بعد إغلاق سجل صيانة أو عطل: إن لم تعد توجد مشكلة صيانة/عطل مفتوحة لهذه المعدة،
 * تُعيدها من 'maintenance' إلى 'available' تلقائياً. مشتركة بين maintenance.js وbreakdowns.js
 * لتفادي تكرار نفس المنطق، ولتجنّب إعادة الحالة سابقاً لأوانها أثناء وجود مشكلة أخرى مفتوحة.
 */
export function restoreStatusIfIdle(equipmentId, actor, note = 'انتهاء آخر مشكلة صيانة/عطل مفتوحة') {
  const db = edb();
  const equipment = getEquipmentById(equipmentId);
  if (!equipment || equipment.status !== 'maintenance') return equipment;
  const openMaintenance = db.prepare(`SELECT COUNT(*) AS n FROM equipment_maintenance_records WHERE equipment_id = ? AND status != 'completed'`).get(equipmentId).n;
  const openBreakdowns = db.prepare(`SELECT COUNT(*) AS n FROM equipment_breakdowns WHERE equipment_id = ? AND status != 'resolved'`).get(equipmentId).n;
  if (openMaintenance > 0 || openBreakdowns > 0) return equipment;
  db.prepare(`UPDATE equipment_assets SET status = 'available', updated_at = datetime('now') WHERE id = ?`).run(equipmentId);
  db.prepare(`
    INSERT INTO equipment_status_log (equipment_id, old_status, new_status, old_location, new_location, old_project_id, new_project_id, note, actor)
    VALUES (?, 'maintenance', 'available', ?, ?, ?, ?, ?, ?)
  `).run(equipmentId, equipment.current_location, equipment.current_location, equipment.current_project_id, equipment.current_project_id, note, actor || null);
  return getEquipmentById(equipmentId);
}

export function listStatusLog(equipmentId) {
  return edb().prepare(`SELECT * FROM equipment_status_log WHERE equipment_id = ? ORDER BY created_at DESC`).all(equipmentId);
}
