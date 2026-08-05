// lib/equipment/db/transfers.js
// نقل المعدات بين المواقع (البند 18) - "تحديث موقع المعدة تلقائياً بعد اكتمال عملية النقل".
import { randomUUID } from 'crypto';
import { edb, TRANSFER_STATUSES } from '../schema.js';
import { ValidationError } from '../../calc/common.js';
import { writeAudit } from './audit.js';
import { getEquipmentById } from './equipment.js';

export function createTransfer(data, actor) {
  if (!data.equipment_id || !data.to_location || !data.transfer_date) {
    throw new ValidationError('بيانات النقل غير مكتملة.', ['المعدة والموقع الجديد وتاريخ النقل كلها مطلوبة.']);
  }
  const db = edb();
  const equipment = getEquipmentById(data.equipment_id);
  if (!equipment) throw new Error('المعدة غير موجودة.');
  const uuid = randomUUID();
  const info = db.prepare(`
    INSERT INTO equipment_transfers
      (uuid, equipment_id, from_location, to_location, from_project_id, to_project_id, transfer_date, responsible, cost, transport_method, status, notes, actor)
    VALUES (@uuid, @equipment_id, @from_location, @to_location, @from_project_id, @to_project_id, @transfer_date, @responsible, @cost, @transport_method, @status, @notes, @actor)
  `).run({
    uuid, equipment_id: data.equipment_id, from_location: data.from_location || equipment.current_location || null,
    to_location: data.to_location, from_project_id: data.from_project_id ?? equipment.current_project_id ?? null,
    to_project_id: data.to_project_id ?? null, transfer_date: data.transfer_date, responsible: data.responsible || null,
    cost: Number(data.cost) || 0, transport_method: data.transport_method || null,
    status: data.status && TRANSFER_STATUSES.includes(data.status) ? data.status : 'planned', notes: data.notes || null, actor: actor || null,
  });
  const transfer = db.prepare(`SELECT * FROM equipment_transfers WHERE id = ?`).get(info.lastInsertRowid);
  writeAudit({ equipment_id: data.equipment_id, entity_type: 'transfer', entity_id: transfer.id, action: 'create', after: transfer, actor });
  return transfer;
}

export function completeTransfer(id, actor) {
  const db = edb();
  const before = db.prepare(`SELECT * FROM equipment_transfers WHERE id = ?`).get(id);
  if (!before) throw new Error('سجل النقل غير موجود.');
  db.prepare(`UPDATE equipment_transfers SET status = 'completed', updated_at = datetime('now') WHERE id = ?`).run(id);

  const equipment = getEquipmentById(before.equipment_id);
  db.prepare(`UPDATE equipment_assets SET current_location = @loc, current_project_id = @pid, updated_at = datetime('now') WHERE id = @id`)
    .run({ loc: before.to_location, pid: before.to_project_id, id: before.equipment_id });
  db.prepare(`
    INSERT INTO equipment_status_log (equipment_id, old_status, new_status, old_location, new_location, old_project_id, new_project_id, note, actor)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'اكتمال نقل المعدة', ?)
  `).run(before.equipment_id, equipment.status, equipment.status, equipment.current_location, before.to_location, equipment.current_project_id, before.to_project_id, actor || null);

  const after = db.prepare(`SELECT * FROM equipment_transfers WHERE id = ?`).get(id);
  writeAudit({ equipment_id: before.equipment_id, entity_type: 'transfer', entity_id: id, action: 'complete', before, after, actor });
  return after;
}

export function cancelTransfer(id, actor) {
  const db = edb();
  const before = db.prepare(`SELECT * FROM equipment_transfers WHERE id = ?`).get(id);
  if (!before) throw new Error('سجل النقل غير موجود.');
  db.prepare(`UPDATE equipment_transfers SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`).run(id);
  const after = db.prepare(`SELECT * FROM equipment_transfers WHERE id = ?`).get(id);
  writeAudit({ equipment_id: before.equipment_id, entity_type: 'transfer', entity_id: id, action: 'cancel', before, after, actor });
  return after;
}

export function listTransfers({ equipment_id, status, page = 1, pageSize = 20 } = {}) {
  const db = edb();
  const where = [];
  const params = {};
  if (equipment_id) { where.push('t.equipment_id = @equipment_id'); params.equipment_id = equipment_id; }
  if (status) { where.push('t.status = @status'); params.status = status; }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS n FROM equipment_transfers t ${whereSql}`).get(params).n;
  const size = Math.min(200, Math.max(1, Number(pageSize) || 20));
  const offset = (Math.max(1, Number(page) || 1) - 1) * size;
  const rows = db.prepare(`
    SELECT t.*, ea.name AS equipment_name, ea.equipment_code
    FROM equipment_transfers t LEFT JOIN equipment_assets ea ON ea.id = t.equipment_id
    ${whereSql} ORDER BY t.transfer_date DESC LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: size, offset });
  return { rows, total, page: Math.max(1, Number(page) || 1), pageSize: size };
}
