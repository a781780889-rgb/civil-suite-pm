// lib/equipment/db/reservations.js
// حجز المعدات (البند 6) - "منع الحجز المزدوج"، "منع الحجز أثناء الصيانة"، "منع الحجز لمعدة
// خارج الخدمة". حجز مستقبلي بحت: لا يُغيّر حالة المعدة تلقائياً (ذلك من اختصاص التخصيص
// الفعلي عبر assignments.js) - يمنع فقط تعارضه مع حجوزات/تخصيصات أخرى لنفس المعدة.
import { randomUUID } from 'crypto';
import { edb, RESERVATION_STATUSES } from '../schema.js';
import { ValidationError } from '../../calc/common.js';
import { writeAudit } from './audit.js';
import { EquipConflictError } from '../apiHelpers.js';
import { findOverlaps, formatConflictMessage } from '../conflicts.js';

const BLOCKED_STATUSES = ['maintenance', 'out_of_service', 'sold', 'archived'];

function activeCandidates(db, equipmentId, excludeId) {
  const reservations = db.prepare(`SELECT id, start_date, end_date, activity FROM equipment_reservations WHERE equipment_id = ? AND status IN ('pending','confirmed') AND id != ?`).all(equipmentId, excludeId ?? -1);
  const assignments = db.prepare(`SELECT id, start_date, end_date, activity FROM equipment_assignments WHERE equipment_id = ? AND status = 'active'`).all(equipmentId);
  return { reservations, assignments };
}

export function createReservation(data, actor) {
  if (!data.equipment_id || !data.project_id || !data.start_date || !data.end_date) {
    throw new ValidationError('بيانات الحجز غير مكتملة.', ['المعدة والمشروع وتاريخ البداية والنهاية كلها مطلوبة.']);
  }
  const db = edb();
  const equipment = db.prepare(`SELECT * FROM equipment_assets WHERE id = ?`).get(data.equipment_id);
  if (!equipment) throw new Error('المعدة غير موجودة.');
  if (BLOCKED_STATUSES.includes(equipment.status)) {
    throw new ValidationError('لا يمكن حجز هذه المعدة حالياً.', [`حالة المعدة "${equipment.status}" لا تسمح بالحجز.`]);
  }

  const { reservations, assignments } = activeCandidates(db, data.equipment_id, null);
  const overlaps = [...findOverlaps(reservations, data.start_date, data.end_date), ...findOverlaps(assignments, data.start_date, data.end_date)];
  if (overlaps.length) throw new EquipConflictError(formatConflictMessage('reservation', overlaps), overlaps);

  const uuid = randomUUID();
  const info = db.prepare(`
    INSERT INTO equipment_reservations (uuid, equipment_id, project_id, activity, start_date, end_date, planned_hours, responsible, status, notes, actor)
    VALUES (@uuid, @equipment_id, @project_id, @activity, @start_date, @end_date, @planned_hours, @responsible, @status, @notes, @actor)
  `).run({
    uuid, equipment_id: data.equipment_id, project_id: data.project_id, activity: data.activity || null,
    start_date: data.start_date, end_date: data.end_date, planned_hours: data.planned_hours ?? null,
    responsible: data.responsible || null, status: data.status && RESERVATION_STATUSES.includes(data.status) ? data.status : 'pending',
    notes: data.notes || null, actor: actor || null,
  });
  const reservation = db.prepare(`SELECT * FROM equipment_reservations WHERE id = ?`).get(info.lastInsertRowid);
  writeAudit({ equipment_id: data.equipment_id, entity_type: 'reservation', entity_id: reservation.id, action: 'create', after: reservation, actor });
  return reservation;
}

export function listReservations({ equipment_id, project_id, status, page = 1, pageSize = 20 } = {}) {
  const db = edb();
  const where = [];
  const params = {};
  if (equipment_id) { where.push('r.equipment_id = @equipment_id'); params.equipment_id = equipment_id; }
  if (project_id) { where.push('r.project_id = @project_id'); params.project_id = project_id; }
  if (status) { where.push('r.status = @status'); params.status = status; }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS n FROM equipment_reservations r ${whereSql}`).get(params).n;
  const size = Math.min(200, Math.max(1, Number(pageSize) || 20));
  const offset = (Math.max(1, Number(page) || 1) - 1) * size;
  const rows = db.prepare(`
    SELECT r.*, ea.name AS equipment_name, ea.equipment_code, p.name AS project_name
    FROM equipment_reservations r
    LEFT JOIN equipment_assets ea ON ea.id = r.equipment_id
    LEFT JOIN projects p ON p.id = r.project_id
    ${whereSql} ORDER BY r.start_date DESC LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: size, offset });
  return { rows, total, page: Math.max(1, Number(page) || 1), pageSize: size };
}

function setReservationStatus(id, status, actor) {
  const db = edb();
  const before = db.prepare(`SELECT * FROM equipment_reservations WHERE id = ?`).get(id);
  if (!before) throw new Error('الحجز غير موجود.');
  db.prepare(`UPDATE equipment_reservations SET status = @status, updated_at = datetime('now') WHERE id = @id`).run({ id, status });
  const after = db.prepare(`SELECT * FROM equipment_reservations WHERE id = ?`).get(id);
  writeAudit({ equipment_id: before.equipment_id, entity_type: 'reservation', entity_id: id, action: `status_${status}`, before, after, actor });
  return after;
}

export const confirmReservation = (id, actor) => setReservationStatus(id, 'confirmed', actor);
export const completeReservation = (id, actor) => setReservationStatus(id, 'completed', actor);
export const cancelReservation = (id, actor) => setReservationStatus(id, 'cancelled', actor);
