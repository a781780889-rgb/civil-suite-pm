// lib/equipment/db/operators.js
// إدارة المشغلين (البند 14) - بيانات المشغل، تراخيصه، والمعدات المصرَّح له بتشغيلها.
// "يجب منع تعيين مشغل غير مؤهل للمعدة عند وجود بيانات اعتماد مطلوبة" -> isOperatorAuthorized().
import { randomUUID } from 'crypto';
import { edb } from '../schema.js';
import { ValidationError } from '../../calc/common.js';
import { writeAudit } from './audit.js';

const WRITABLE = [
  'name', 'employee_no', 'national_id', 'specialization', 'license_no', 'license_type',
  'license_expiry', 'training_notes', 'allowed_categories', 'performance_notes', 'is_active',
];

function normalize(data) {
  const out = { ...data };
  if (Array.isArray(out.allowed_categories)) out.allowed_categories = JSON.stringify(out.allowed_categories);
  return out;
}

function denormalize(row) {
  if (!row) return row;
  let allowed = [];
  try { allowed = JSON.parse(row.allowed_categories || '[]'); } catch { allowed = []; }
  return { ...row, allowed_categories: allowed };
}

export function createOperator(data, actor) {
  if (!data.name) throw new ValidationError('اسم المشغل مطلوب.', ['اسم المشغل مطلوب.']);
  const db = edb();
  const uuid = randomUUID();
  const values = normalize({ is_active: 1, ...data });
  const cols = ['uuid', ...WRITABLE.filter((f) => f in values)];
  const params = { uuid };
  for (const f of WRITABLE) if (f in values) params[f] = values[f];
  db.prepare(`INSERT INTO equipment_operators (${cols.join(', ')}) VALUES (${cols.map((c) => '@' + c).join(', ')})`).run(params);
  const id = db.prepare(`SELECT id FROM equipment_operators WHERE uuid = ?`).get(uuid).id;
  writeAudit({ entity_type: 'operator', entity_id: id, action: 'create', after: values, actor });
  return getOperatorById(id);
}

export function listOperators({ page = 1, pageSize = 50, search, is_active, category_key } = {}) {
  const db = edb();
  const where = [];
  const params = {};
  if (is_active != null) { where.push('is_active = @is_active'); params.is_active = is_active ? 1 : 0; }
  if (search) { where.push('(name LIKE @search OR employee_no LIKE @search OR license_no LIKE @search)'); params.search = `%${search}%`; }
  if (category_key) { where.push(`allowed_categories LIKE @cat`); params.cat = `%"${category_key}"%`; }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS n FROM equipment_operators ${whereSql}`).get(params).n;
  const size = Math.min(200, Math.max(1, Number(pageSize) || 50));
  const offset = (Math.max(1, Number(page) || 1) - 1) * size;
  const rows = db.prepare(`SELECT * FROM equipment_operators ${whereSql} ORDER BY name LIMIT @limit OFFSET @offset`).all({ ...params, limit: size, offset });
  return { rows: rows.map(denormalize), total, page: Math.max(1, Number(page) || 1), pageSize: size };
}

export function getOperatorById(id) {
  const row = edb().prepare(`SELECT * FROM equipment_operators WHERE id = ?`).get(id);
  return denormalize(row);
}

export function updateOperator(id, data, actor) {
  const db = edb();
  const before = getOperatorById(id);
  if (!before) throw new Error('المشغل غير موجود.');
  const values = normalize(data);
  const fields = WRITABLE.filter((f) => f in values);
  if (!fields.length) return before;
  const setSql = fields.map((f) => `${f} = @${f}`).join(', ');
  const params = { id };
  for (const f of fields) params[f] = values[f];
  db.prepare(`UPDATE equipment_operators SET ${setSql}, updated_at = datetime('now') WHERE id = @id`).run(params);
  const after = getOperatorById(id);
  writeAudit({ entity_type: 'operator', entity_id: id, action: 'update', before, after, actor });
  return after;
}

export function deleteOperator(id, actor) {
  const db = edb();
  const before = getOperatorById(id);
  if (!before) throw new Error('المشغل غير موجود.');
  const linked = db.prepare(`SELECT COUNT(*) AS n FROM equipment_operation_logs WHERE operator_id = ?`).get(id).n;
  if (linked > 0) {
    db.prepare(`UPDATE equipment_operators SET is_active = 0, updated_at = datetime('now') WHERE id = ?`).run(id);
    writeAudit({ entity_type: 'operator', entity_id: id, action: 'deactivate', before, actor });
    return { deactivated: true };
  }
  db.prepare(`DELETE FROM equipment_operator_authorizations WHERE operator_id = ?`).run(id);
  db.prepare(`DELETE FROM equipment_operators WHERE id = ?`).run(id);
  writeAudit({ entity_type: 'operator', entity_id: id, action: 'delete', before, actor });
  return { deleted: true };
}

/** تفويض صريح لمشغل على معدة محددة (البند 14: "ربط كل معدة بالمشغلين المصرح لهم"). */
export function authorizeOperator(operatorId, equipmentId, notes, actor) {
  const db = edb();
  db.prepare(`
    INSERT OR IGNORE INTO equipment_operator_authorizations (operator_id, equipment_id, notes) VALUES (?, ?, ?)
  `).run(operatorId, equipmentId, notes || null);
  writeAudit({ equipment_id: equipmentId, entity_type: 'operator_authorization', entity_id: operatorId, action: 'authorize', actor });
  return listAuthorizedOperators(equipmentId);
}

export function revokeAuthorization(operatorId, equipmentId, actor) {
  edb().prepare(`DELETE FROM equipment_operator_authorizations WHERE operator_id = ? AND equipment_id = ?`).run(operatorId, equipmentId);
  writeAudit({ equipment_id: equipmentId, entity_type: 'operator_authorization', entity_id: operatorId, action: 'revoke', actor });
  return listAuthorizedOperators(equipmentId);
}

export function listAuthorizedOperators(equipmentId) {
  const rows = edb().prepare(`
    SELECT o.* FROM equipment_operator_authorizations a
    JOIN equipment_operators o ON o.id = a.operator_id
    WHERE a.equipment_id = ?
    ORDER BY o.name
  `).all(equipmentId);
  return rows.map(denormalize);
}

/**
 * يفحص هل مشغل مؤهل لتشغيل معدة معيّنة: تفويض صريح، أو تصنيف المعدة ضمن allowed_categories،
 * بشرط سريان الرخصة. يُستخدم قبل حفظ سجل تشغيل/تخصيص (البند 14: "منع تعيين مشغل غير مؤهل").
 * يُعيد {authorized, reasons[]} بدل رمي استثناء مباشرة، ليقرر المستدعي مستوى الصرامة.
 */
export function checkOperatorAuthorization(operatorId, equipmentId) {
  const db = edb();
  const operator = getOperatorById(operatorId);
  const equipment = db.prepare(`SELECT id, category_key FROM equipment_assets WHERE id = ?`).get(equipmentId);
  const reasons = [];
  if (!operator) { reasons.push('المشغل غير موجود.'); return { authorized: false, reasons }; }
  if (!equipment) { reasons.push('المعدة غير موجودة.'); return { authorized: false, reasons }; }
  if (!operator.is_active) reasons.push('المشغل غير نشط حالياً.');
  if (operator.license_expiry) {
    const expired = new Date(operator.license_expiry).getTime() < Date.now();
    if (expired) reasons.push(`رخصة المشغل منتهية بتاريخ ${operator.license_expiry}.`);
  }
  const explicit = db.prepare(`SELECT 1 FROM equipment_operator_authorizations WHERE operator_id = ? AND equipment_id = ?`).get(operatorId, equipmentId);
  const byCategory = equipment.category_key && operator.allowed_categories.includes(equipment.category_key);
  if (!explicit && !byCategory) reasons.push('المشغل غير مصرَّح له بتشغيل هذا التصنيف من المعدات.');
  return { authorized: reasons.length === 0, reasons };
}
