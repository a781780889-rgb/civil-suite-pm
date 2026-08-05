// lib/equipment/db/assignments.js
// تخصيص المعدات على المشاريع (البند 5) - "منع تعيين نفس المعدة لمشروعين في نفس الفترة
// الزمنية بدون تنبيه واضح": نطبّقها كمنع صريح (409) بدل سماح صامت، فالمنع نفسه هو أوضح تنبيه.
// التخصيص النشط (status='active') هو ما يُحرّك حالة/موقع/مشروع المعدة الحالي فعلياً.
import { randomUUID } from 'crypto';
import { edb, ASSIGNMENT_STATUSES } from '../schema.js';
import { ValidationError } from '../../calc/common.js';
import { writeAudit } from './audit.js';
import { EquipConflictError } from '../apiHelpers.js';
import { findOverlaps, formatConflictMessage } from '../conflicts.js';
import { checkOperatorAuthorization } from './operators.js';

const BLOCKED_STATUSES = ['out_of_service', 'sold', 'archived'];

function activeCandidates(db, equipmentId, excludeId) {
  const assignments = db.prepare(`SELECT id, start_date, end_date, activity FROM equipment_assignments WHERE equipment_id = ? AND status = 'active' AND id != ?`).all(equipmentId, excludeId ?? -1);
  const reservations = db.prepare(`SELECT id, start_date, end_date, activity FROM equipment_reservations WHERE equipment_id = ? AND status IN ('pending','confirmed')`).all(equipmentId);
  return { assignments, reservations };
}

export function createAssignment(data, actor) {
  if (!data.equipment_id || !data.project_id || !data.start_date) {
    throw new ValidationError('بيانات التخصيص غير مكتملة.', ['المعدة والمشروع وتاريخ البداية كلها مطلوبة.']);
  }
  const db = edb();
  const equipment = db.prepare(`SELECT * FROM equipment_assets WHERE id = ?`).get(data.equipment_id);
  if (!equipment) throw new Error('المعدة غير موجودة.');
  if (BLOCKED_STATUSES.includes(equipment.status)) {
    throw new ValidationError('لا يمكن تخصيص هذه المعدة حالياً.', [`حالة المعدة "${equipment.status}" لا تسمح بالتخصيص.`]);
  }
  if (data.operator_id) {
    const auth = checkOperatorAuthorization(data.operator_id, data.equipment_id);
    if (!auth.authorized) throw new ValidationError('المشغل غير مؤهل لتشغيل هذه المعدة.', auth.reasons);
  }

  const { assignments, reservations } = activeCandidates(db, data.equipment_id, null);
  const overlaps = [...findOverlaps(assignments, data.start_date, data.end_date), ...findOverlaps(reservations, data.start_date, data.end_date)];
  if (overlaps.length) throw new EquipConflictError(formatConflictMessage('assignment', overlaps), overlaps);

  const uuid = randomUUID();
  const info = db.prepare(`
    INSERT INTO equipment_assignments (uuid, equipment_id, project_id, operator_id, activity, location, start_date, end_date, status, notes, actor)
    VALUES (@uuid, @equipment_id, @project_id, @operator_id, @activity, @location, @start_date, @end_date, @status, @notes, @actor)
  `).run({
    uuid, equipment_id: data.equipment_id, project_id: data.project_id, operator_id: data.operator_id || null,
    activity: data.activity || null, location: data.location || equipment.current_location || null,
    start_date: data.start_date, end_date: data.end_date || null,
    status: data.status && ASSIGNMENT_STATUSES.includes(data.status) ? data.status : 'active',
    notes: data.notes || null, actor: actor || null,
  });
  const assignment = db.prepare(`SELECT * FROM equipment_assignments WHERE id = ?`).get(info.lastInsertRowid);

  if (assignment.status === 'active') {
    const newStatus = ['available', 'reserved'].includes(equipment.status) ? 'in_use' : equipment.status;
    db.prepare(`UPDATE equipment_assets SET current_project_id = @pid, current_location = @loc, status = @status, updated_at = datetime('now') WHERE id = @id`)
      .run({ pid: data.project_id, loc: assignment.location, status: newStatus, id: data.equipment_id });
    db.prepare(`
      INSERT INTO equipment_status_log (equipment_id, old_status, new_status, old_location, new_location, old_project_id, new_project_id, note, actor)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'تخصيص لمشروع', ?)
    `).run(data.equipment_id, equipment.status, newStatus, equipment.current_location, assignment.location, equipment.current_project_id, data.project_id, actor || null);
  }

  writeAudit({ equipment_id: data.equipment_id, entity_type: 'assignment', entity_id: assignment.id, action: 'create', after: assignment, actor });
  return assignment;
}

export function listAssignments({ equipment_id, project_id, status, page = 1, pageSize = 20 } = {}) {
  const db = edb();
  const where = [];
  const params = {};
  if (equipment_id) { where.push('a.equipment_id = @equipment_id'); params.equipment_id = equipment_id; }
  if (project_id) { where.push('a.project_id = @project_id'); params.project_id = project_id; }
  if (status) { where.push('a.status = @status'); params.status = status; }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS n FROM equipment_assignments a ${whereSql}`).get(params).n;
  const size = Math.min(200, Math.max(1, Number(pageSize) || 20));
  const offset = (Math.max(1, Number(page) || 1) - 1) * size;
  const rows = db.prepare(`
    SELECT a.*, ea.name AS equipment_name, ea.equipment_code, p.name AS project_name, op.name AS operator_name
    FROM equipment_assignments a
    LEFT JOIN equipment_assets ea ON ea.id = a.equipment_id
    LEFT JOIN projects p ON p.id = a.project_id
    LEFT JOIN equipment_operators op ON op.id = a.operator_id
    ${whereSql} ORDER BY a.start_date DESC LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: size, offset });
  return { rows, total, page: Math.max(1, Number(page) || 1), pageSize: size };
}

function closeAssignment(id, status, actor, endDate) {
  const db = edb();
  const before = db.prepare(`SELECT * FROM equipment_assignments WHERE id = ?`).get(id);
  if (!before) throw new Error('التخصيص غير موجود.');
  db.prepare(`UPDATE equipment_assignments SET status = @status, end_date = COALESCE(@end_date, end_date, datetime('now')), updated_at = datetime('now') WHERE id = @id`)
    .run({ id, status, end_date: endDate || null });

  const stillActive = db.prepare(`SELECT COUNT(*) AS n FROM equipment_assignments WHERE equipment_id = ? AND status = 'active' AND id != ?`).get(before.equipment_id, id).n;
  if (stillActive === 0) {
    const equipment = db.prepare(`SELECT * FROM equipment_assets WHERE id = ?`).get(before.equipment_id);
    if (equipment && equipment.status === 'in_use') {
      db.prepare(`UPDATE equipment_assets SET status = 'available', updated_at = datetime('now') WHERE id = ?`).run(before.equipment_id);
      db.prepare(`
        INSERT INTO equipment_status_log (equipment_id, old_status, new_status, old_location, new_location, old_project_id, new_project_id, note, actor)
        VALUES (?, 'in_use', 'available', ?, ?, ?, ?, 'إنهاء آخر تخصيص نشط', ?)
      `).run(before.equipment_id, equipment.current_location, equipment.current_location, equipment.current_project_id, equipment.current_project_id, actor || null);
    }
  }

  const after = db.prepare(`SELECT * FROM equipment_assignments WHERE id = ?`).get(id);
  writeAudit({ equipment_id: before.equipment_id, entity_type: 'assignment', entity_id: id, action: `status_${status}`, before, after, actor });
  return after;
}

export const completeAssignment = (id, actor, endDate) => closeAssignment(id, 'completed', actor, endDate);
export const cancelAssignment = (id, actor) => closeAssignment(id, 'cancelled', actor, null);
