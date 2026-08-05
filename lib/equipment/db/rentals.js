// lib/equipment/db/rentals.js
// المعدات المؤجرة (البند 17) - تفاصيل عقد الاستئجار، مع ربط تكلفة الإيجار بالميزانية.
import { randomUUID } from 'crypto';
import { edb, RENTAL_STATUSES } from '../schema.js';
import { ValidationError } from '../../calc/common.js';
import { writeAudit } from './audit.js';
import { getEquipmentById } from './equipment.js';
import { createBudgetItem } from '../../pm/db/budget.js';

export function createRental(data, actor) {
  if (!data.equipment_id || !data.rental_company || !data.rental_start) {
    throw new ValidationError('بيانات عقد الإيجار غير مكتملة.', ['المعدة وشركة التأجير وتاريخ بداية الإيجار كلها مطلوبة.']);
  }
  const db = edb();
  const equipment = getEquipmentById(data.equipment_id);
  if (!equipment) throw new Error('المعدة غير موجودة.');
  const uuid = randomUUID();
  const info = db.prepare(`
    INSERT INTO equipment_rentals
      (uuid, equipment_id, rental_company, contract_no, rental_start, rental_end, rental_cost_total, hourly_cost, terms, insurance_info, contract_status, notes, actor)
    VALUES (@uuid, @equipment_id, @rental_company, @contract_no, @rental_start, @rental_end, @rental_cost_total, @hourly_cost, @terms, @insurance_info, @contract_status, @notes, @actor)
  `).run({
    uuid, equipment_id: data.equipment_id, rental_company: data.rental_company, contract_no: data.contract_no || null,
    rental_start: data.rental_start, rental_end: data.rental_end || null, rental_cost_total: Number(data.rental_cost_total) || 0,
    hourly_cost: Number(data.hourly_cost) || 0, terms: data.terms || null, insurance_info: data.insurance_info || null,
    contract_status: data.contract_status && RENTAL_STATUSES.includes(data.contract_status) ? data.contract_status : 'active',
    notes: data.notes || null, actor: actor || null,
  });
  const rental = db.prepare(`SELECT * FROM equipment_rentals WHERE id = ?`).get(info.lastInsertRowid);

  if (equipment.current_project_id && Number(data.rental_cost_total) > 0) {
    try {
      createBudgetItem({
        project_id: equipment.current_project_id, item_type: 'expense', category: 'equipment_rental',
        description: `إيجار معدة - ${equipment.name} (${equipment.equipment_code}) من ${data.rental_company}`,
        amount: Number(data.rental_cost_total), date: data.rental_start, reference_no: `RENT-${rental.id}`, actor,
      });
    } catch (e) { console.error('[equipment] فشل ربط تكلفة الإيجار بالميزانية:', e.message); }
  }

  writeAudit({ equipment_id: data.equipment_id, entity_type: 'rental', entity_id: rental.id, action: 'create', after: rental, actor });
  return rental;
}

export function listRentals({ equipment_id, contract_status, page = 1, pageSize = 20 } = {}) {
  const db = edb();
  const where = [];
  const params = {};
  if (equipment_id) { where.push('r.equipment_id = @equipment_id'); params.equipment_id = equipment_id; }
  if (contract_status) { where.push('r.contract_status = @contract_status'); params.contract_status = contract_status; }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS n FROM equipment_rentals r ${whereSql}`).get(params).n;
  const size = Math.min(200, Math.max(1, Number(pageSize) || 20));
  const offset = (Math.max(1, Number(page) || 1) - 1) * size;
  const rows = db.prepare(`
    SELECT r.*, ea.name AS equipment_name, ea.equipment_code
    FROM equipment_rentals r LEFT JOIN equipment_assets ea ON ea.id = r.equipment_id
    ${whereSql} ORDER BY r.rental_start DESC LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: size, offset });
  return { rows, total, page: Math.max(1, Number(page) || 1), pageSize: size };
}

export function updateRentalStatus(id, contract_status, actor) {
  if (!RENTAL_STATUSES.includes(contract_status)) throw new ValidationError('حالة عقد غير صالحة.', [`القيم المسموحة: ${RENTAL_STATUSES.join('، ')}.`]);
  const db = edb();
  const before = db.prepare(`SELECT * FROM equipment_rentals WHERE id = ?`).get(id);
  if (!before) throw new Error('عقد الإيجار غير موجود.');
  db.prepare(`UPDATE equipment_rentals SET contract_status = @s, updated_at = datetime('now') WHERE id = @id`).run({ s: contract_status, id });
  const after = db.prepare(`SELECT * FROM equipment_rentals WHERE id = ?`).get(id);
  writeAudit({ equipment_id: before.equipment_id, entity_type: 'rental', entity_id: id, action: `status_${contract_status}`, before, after, actor });
  return after;
}

export function listExpiringRentals(daysAhead = 14) {
  return edb().prepare(`
    SELECT r.*, ea.name AS equipment_name FROM equipment_rentals r LEFT JOIN equipment_assets ea ON ea.id = r.equipment_id
    WHERE r.contract_status = 'active' AND r.rental_end IS NOT NULL AND r.rental_end <= date('now', '+' || ? || ' days')
  `).all(daysAhead);
}
