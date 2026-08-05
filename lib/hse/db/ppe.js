// lib/hse/db/ppe.js
// معدات الوقاية الشخصية PPE (البند 9). التوزيع يخصم فعلياً من quantity_on_hand في نفس
// المعاملة (transaction) - وليس عداداً منفصلاً قد يتعارض مع الكمية الحقيقية، تماماً كخصم
// equipment_spare_parts.quantity عند استخدام قطعة غيار في القسم السابع.
import { randomUUID } from 'crypto';
import { hdb } from '../schema.js';
import { writeHseAudit } from './audit.js';
import { upsertNotification } from './notifications.js';
import { ppeLowStockNotification } from '../notifications.js';
import { ValidationError } from '../../calc/common.js';

// -------------------- الكتالوج/المخزون --------------------
export function createPpeItem(data, actor) {
  if (!data.item_type || !data.item_name) throw new ValidationError('نوع المعدة واسمها مطلوبان.');
  const db = hdb();
  const info = db.prepare(
    `INSERT INTO hse_ppe_items (item_type, item_name, unit, quantity_on_hand, min_stock, default_lifespan_days, unit_cost)
     VALUES (@item_type, @item_name, @unit, @quantity_on_hand, @min_stock, @default_lifespan_days, @unit_cost)`
  ).run({
    item_type: data.item_type, item_name: data.item_name, unit: data.unit || 'قطعة',
    quantity_on_hand: data.quantity_on_hand || 0, min_stock: data.min_stock || 0,
    default_lifespan_days: data.default_lifespan_days || null, unit_cost: data.unit_cost || 0,
  });
  const created = db.prepare(`SELECT * FROM hse_ppe_items WHERE id = ?`).get(info.lastInsertRowid);
  writeHseAudit(db, { project_id: null, entity_type: 'ppe_item', entity_id: created.id, action: 'create', before: null, after: created, actor });
  return created;
}

export function listPpeItems({ item_type, includeArchived = false } = {}) {
  const db = hdb();
  let where = includeArchived ? ' WHERE 1=1' : ' WHERE is_archived = 0';
  const params = {};
  if (item_type) { where += ' AND item_type = @item_type'; params.item_type = item_type; }
  return db.prepare(`SELECT * FROM hse_ppe_items${where} ORDER BY item_name ASC`).all(params);
}

export function adjustPpeStock(itemId, deltaQuantity, actor, note) {
  const db = hdb();
  const run = db.transaction(() => {
    const before = db.prepare(`SELECT * FROM hse_ppe_items WHERE id = ?`).get(itemId);
    if (!before) throw new ValidationError('صنف معدة الوقاية غير موجود.');
    const nextQty = before.quantity_on_hand + deltaQuantity;
    if (nextQty < 0) throw new ValidationError(`الكمية المتوفرة (${before.quantity_on_hand}) غير كافية لخصم ${Math.abs(deltaQuantity)}.`);
    db.prepare(`UPDATE hse_ppe_items SET quantity_on_hand = ?, updated_at = datetime('now') WHERE id = ?`).run(nextQty, itemId);
    const after = db.prepare(`SELECT * FROM hse_ppe_items WHERE id = ?`).get(itemId);
    writeHseAudit(db, { project_id: null, entity_type: 'ppe_item', entity_id: itemId, action: 'adjust_stock', before, after: { ...after, note }, actor });
    if (after.min_stock > 0 && after.quantity_on_hand <= after.min_stock) upsertNotification(ppeLowStockNotification(after));
    return after;
  });
  return run();
}

// -------------------- التوزيع --------------------
function validateDistribution(data) {
  const errors = [];
  if (!data.ppe_item_id) errors.push('صنف معدة الوقاية مطلوب.');
  if (!data.project_id) errors.push('المشروع مطلوب.');
  if (!data.employee_name || !data.employee_name.trim()) errors.push('اسم الموظف المستلم مطلوب.');
  if (!data.issue_date) errors.push('تاريخ التسليم مطلوب.');
  if (errors.length) throw new ValidationError(errors);
}

export function distributePpe(data, actor) {
  validateDistribution(data);
  const db = hdb();
  const run = db.transaction(() => {
    const item = db.prepare(`SELECT * FROM hse_ppe_items WHERE id = ?`).get(data.ppe_item_id);
    if (!item) throw new ValidationError('صنف معدة الوقاية غير موجود.');
    const qty = data.quantity || 1;
    if (item.quantity_on_hand < qty) throw new ValidationError(`الكمية المتوفرة من "${item.item_name}" (${item.quantity_on_hand}) غير كافية.`);
    let expiryDate = data.expiry_date || null;
    if (!expiryDate && item.default_lifespan_days) {
      const d = new Date(data.issue_date);
      d.setDate(d.getDate() + item.default_lifespan_days);
      expiryDate = d.toISOString().slice(0, 10);
    }
    const uuid = randomUUID();
    const info = db.prepare(
      `INSERT INTO hse_ppe_distributions (uuid, ppe_item_id, project_id, team_member_id, employee_name, quantity, issue_date, expiry_date, condition, status)
       VALUES (@uuid, @ppe_item_id, @project_id, @team_member_id, @employee_name, @quantity, @issue_date, @expiry_date, 'good', 'issued')`
    ).run({ uuid, ppe_item_id: data.ppe_item_id, project_id: data.project_id, team_member_id: data.team_member_id || null,
      employee_name: data.employee_name.trim(), quantity: qty, issue_date: data.issue_date, expiry_date: expiryDate });
    // خصم فعلي من المخزون داخل نفس المعاملة (البند 25: منع تكرار/تضارب البيانات)
    const nextQty = item.quantity_on_hand - qty;
    db.prepare(`UPDATE hse_ppe_items SET quantity_on_hand = ?, updated_at = datetime('now') WHERE id = ?`).run(nextQty, item.id);
    if (item.min_stock > 0 && nextQty <= item.min_stock) {
      upsertNotification(ppeLowStockNotification({ ...item, quantity_on_hand: nextQty }));
    }
    const created = getDistributionById(info.lastInsertRowid);
    writeHseAudit(db, { project_id: data.project_id, entity_type: 'ppe_distribution', entity_id: created.id, action: 'create', before: null, after: created, actor });
    return created;
  });
  return run();
}

export function getDistributionById(id) {
  return hdb().prepare(
    `SELECT d.*, i.item_name, i.item_type FROM hse_ppe_distributions d JOIN hse_ppe_items i ON i.id = d.ppe_item_id WHERE d.id = ?`
  ).get(id);
}

export function listDistributions({ project_id, employee_name, status, page = 1, pageSize = 20 } = {}) {
  const db = hdb();
  let where = ' WHERE 1=1';
  const params = {};
  if (project_id) { where += ' AND d.project_id = @project_id'; params.project_id = project_id; }
  if (employee_name) { where += ' AND d.employee_name LIKE @employee_name'; params.employee_name = `%${employee_name}%`; }
  if (status) { where += ' AND d.status = @status'; params.status = status; }
  const total = db.prepare(`SELECT COUNT(*) AS c FROM hse_ppe_distributions d${where}`).get(params).c;
  const offset = (page - 1) * pageSize;
  const rows = db.prepare(
    `SELECT d.*, i.item_name, i.item_type FROM hse_ppe_distributions d JOIN hse_ppe_items i ON i.id = d.ppe_item_id${where}
     ORDER BY d.issue_date DESC LIMIT @limit OFFSET @offset`
  ).all({ ...params, limit: pageSize, offset });
  return { rows, total, page, pageSize };
}

/** إعادة معدة (تُعيد الكمية للمخزون إن كانت بحالة جيدة). */
export function returnPpe(distId, { condition }, actor) {
  const db = hdb();
  const run = db.transaction(() => {
    const before = getDistributionById(distId);
    if (!before) throw new ValidationError('سجل التوزيع غير موجود.');
    if (before.status !== 'issued') throw new ValidationError('لا يمكن إرجاع معدة ليست بحالة "مُسلَّمة".');
    db.prepare(`UPDATE hse_ppe_distributions SET status='returned', condition=@condition WHERE id=@id`).run({ id: distId, condition: condition || 'good' });
    if (condition === 'good') {
      db.prepare(`UPDATE hse_ppe_items SET quantity_on_hand = quantity_on_hand + ?, updated_at = datetime('now') WHERE id = ?`).run(before.quantity, before.ppe_item_id);
    }
    const after = getDistributionById(distId);
    writeHseAudit(db, { project_id: after.project_id, entity_type: 'ppe_distribution', entity_id: distId, action: 'return', before, after, actor });
    return after;
  });
  return run();
}
