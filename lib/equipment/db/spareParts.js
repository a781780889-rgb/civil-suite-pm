// lib/equipment/db/spareParts.js
// قطع الغيار (البند 13) - المخزون + سجل الاستخدام المرتبط بالصيانة/الأعطال، مع تنبيه انخفاض
// المخزون تلقائياً (البند 23). usePart() هي نقطة الدخول الوحيدة لخصم الكمية - تُستدعى من
// maintenance.js وbreakdowns.js بدل التلاعب المباشر بجدول equipment_spare_parts.
import { randomUUID } from 'crypto';
import { edb } from '../schema.js';
import { ValidationError } from '../../calc/common.js';
import { writeAudit } from './audit.js';
import { lowStockNotification } from '../notifications.js';
import { upsertNotification } from './notifications.js';

const WRITABLE = ['part_name', 'part_number', 'manufacturer', 'supplier', 'compatible_categories', 'unit_price', 'quantity_on_hand', 'min_stock', 'storage_location', 'notes'];

function normalize(data) {
  const out = { ...data };
  if (Array.isArray(out.compatible_categories)) out.compatible_categories = JSON.stringify(out.compatible_categories);
  return out;
}
function denormalize(row) {
  if (!row) return row;
  let compat = [];
  try { compat = JSON.parse(row.compatible_categories || '[]'); } catch { compat = []; }
  return { ...row, compatible_categories: compat };
}

export function createPart(data, actor) {
  if (!data.part_name) throw new ValidationError('اسم القطعة مطلوب.', ['اسم القطعة مطلوب.']);
  const db = edb();
  const uuid = randomUUID();
  const values = normalize({ unit_price: 0, quantity_on_hand: 0, min_stock: 0, compatible_categories: [], ...data });
  const cols = ['uuid', ...WRITABLE];
  const params = { uuid };
  for (const f of WRITABLE) params[f] = values[f] ?? (f === 'compatible_categories' ? '[]' : null);
  db.prepare(`INSERT INTO equipment_spare_parts (${cols.join(', ')}) VALUES (${cols.map((c) => '@' + c).join(', ')})`).run(params);
  const id = db.prepare(`SELECT id FROM equipment_spare_parts WHERE uuid = ?`).get(uuid).id;
  writeAudit({ entity_type: 'spare_part', entity_id: id, action: 'create', after: values, actor });
  return getPartById(id);
}

export function listParts({ search, low_stock_only = false, page = 1, pageSize = 30 } = {}) {
  const db = edb();
  const where = [];
  const params = {};
  if (search) { where.push('(part_name LIKE @search OR part_number LIKE @search)'); params.search = `%${search}%`; }
  if (low_stock_only) where.push('quantity_on_hand <= min_stock');
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS n FROM equipment_spare_parts ${whereSql}`).get(params).n;
  const size = Math.min(200, Math.max(1, Number(pageSize) || 30));
  const offset = (Math.max(1, Number(page) || 1) - 1) * size;
  const rows = db.prepare(`SELECT * FROM equipment_spare_parts ${whereSql} ORDER BY part_name LIMIT @limit OFFSET @offset`).all({ ...params, limit: size, offset });
  return { rows: rows.map(denormalize), total, page: Math.max(1, Number(page) || 1), pageSize: size };
}

export function getPartById(id) {
  return denormalize(edb().prepare(`SELECT * FROM equipment_spare_parts WHERE id = ?`).get(id));
}

export function updatePart(id, data, actor) {
  const db = edb();
  const before = getPartById(id);
  if (!before) throw new Error('القطعة غير موجودة.');
  const values = normalize(data);
  const fields = WRITABLE.filter((f) => f in values);
  if (!fields.length) return before;
  const setSql = fields.map((f) => `${f} = @${f}`).join(', ');
  const params = { id };
  for (const f of fields) params[f] = values[f];
  db.prepare(`UPDATE equipment_spare_parts SET ${setSql}, updated_at = datetime('now') WHERE id = @id`).run(params);
  const after = getPartById(id);
  writeAudit({ entity_type: 'spare_part', entity_id: id, action: 'update', before, after, actor });
  checkLowStock(after);
  return after;
}

export function deletePart(id, actor) {
  const db = edb();
  const before = getPartById(id);
  if (!before) throw new Error('القطعة غير موجودة.');
  const used = db.prepare(`SELECT COUNT(*) AS n FROM equipment_spare_part_usage WHERE part_id = ?`).get(id).n;
  if (used > 0) throw new ValidationError('لا يمكن حذف قطعة لها سجل استخدام.', [`القطعة مستخدمة في ${used} عملية صيانة/عطل.`]);
  db.prepare(`DELETE FROM equipment_spare_parts WHERE id = ?`).run(id);
  writeAudit({ entity_type: 'spare_part', entity_id: id, action: 'delete', before, actor });
  return { deleted: true };
}

function checkLowStock(part) {
  if (Number(part.quantity_on_hand) <= Number(part.min_stock)) {
    upsertNotification(lowStockNotification(part));
  }
}

/** خصم كمية من المخزون عند استخدامها في صيانة أو عطل - نقطة الدخول الوحيدة (البند 13). */
export function usePart(partId, quantity, { maintenance_record_id = null, breakdown_id = null, used_date, actor } = {}) {
  const db = edb();
  const part = getPartById(partId);
  if (!part) throw new Error('القطعة غير موجودة.');
  const qty = Number(quantity);
  if (!qty || qty <= 0) throw new ValidationError('الكمية غير صالحة.', ['يجب أن تكون الكمية المستخدمة أكبر من صفر.']);
  if (!maintenance_record_id && !breakdown_id) {
    throw new ValidationError('ربط الاستخدام مطلوب.', ['يجب ربط استخدام القطعة بسجل صيانة أو عطل.']);
  }
  const totalCost = Math.round(qty * Number(part.unit_price) * 100) / 100;

  const info = db.prepare(`
    INSERT INTO equipment_spare_part_usage (part_id, maintenance_record_id, breakdown_id, quantity, unit_price_at_use, total_cost, used_date, actor)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(partId, maintenance_record_id, breakdown_id, qty, part.unit_price, totalCost, used_date || new Date().toISOString().slice(0, 10), actor || null);

  db.prepare(`UPDATE equipment_spare_parts SET quantity_on_hand = quantity_on_hand - @qty, updated_at = datetime('now') WHERE id = @id`).run({ qty, id: partId });
  const after = getPartById(partId);
  writeAudit({ entity_type: 'spare_part_usage', entity_id: info.lastInsertRowid, action: 'use', before: { quantity_on_hand: part.quantity_on_hand }, after: { quantity_on_hand: after.quantity_on_hand }, actor });
  checkLowStock(after);
  return { usageId: info.lastInsertRowid, totalCost, part: after };
}

export function listUsageFor({ maintenance_record_id, breakdown_id }) {
  const db = edb();
  if (maintenance_record_id) {
    return db.prepare(`SELECT u.*, p.part_name, p.part_number FROM equipment_spare_part_usage u JOIN equipment_spare_parts p ON p.id = u.part_id WHERE u.maintenance_record_id = ?`).all(maintenance_record_id);
  }
  if (breakdown_id) {
    return db.prepare(`SELECT u.*, p.part_name, p.part_number FROM equipment_spare_part_usage u JOIN equipment_spare_parts p ON p.id = u.part_id WHERE u.breakdown_id = ?`).all(breakdown_id);
  }
  return [];
}
