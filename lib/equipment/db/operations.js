// lib/equipment/db/operations.js
// سجل التشغيل (البند 7) - "يجب حساب ساعات التشغيل تلقائياً". سجل ملحق فقط (Append-only):
// لا تعديل على ساعات التشغيل/التاريخ بعد الحفظ، ولا حذف - يحقق حرفياً البند 28 ("منع تعديل
// ساعات التشغيل... من غير المخوَّل") والبند 29 ("منع حذف السجلات التشغيلية المهمة نهائياً").
import { randomUUID } from 'crypto';
import { edb } from '../schema.js';
import { ValidationError } from '../../calc/common.js';
import { writeAudit } from './audit.js';
import { recordHourMeterReading } from './hourMeter.js';
import { checkOperatorAuthorization } from './operators.js';

function computeHours(log_date, start_time, end_time, fallbackHours) {
  if (start_time && end_time) {
    const start = new Date(`${log_date}T${start_time}`);
    let end = new Date(`${log_date}T${end_time}`);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      if (end <= start) end = new Date(end.getTime() + 24 * 3600 * 1000); // نوبة تمتد لما بعد منتصف الليل
      return Math.round(((end - start) / 3600000) * 100) / 100;
    }
  }
  return Number(fallbackHours) || 0;
}

export function createOperationLog(data, actor) {
  if (!data.equipment_id || !data.log_date) {
    throw new ValidationError('بيانات سجل التشغيل غير مكتملة.', ['المعدة وتاريخ التشغيل حقلان مطلوبان.']);
  }
  const db = edb();
  const equipment = db.prepare(`SELECT * FROM equipment_assets WHERE id = ?`).get(data.equipment_id);
  if (!equipment) throw new Error('المعدة غير موجودة.');
  if (['out_of_service', 'sold', 'archived'].includes(equipment.status)) {
    throw new ValidationError('لا يمكن تسجيل تشغيل لمعدة بهذه الحالة.', [`حالة المعدة الحالية: ${equipment.status}.`]);
  }
  if (data.operator_id) {
    const auth = checkOperatorAuthorization(data.operator_id, data.equipment_id);
    if (!auth.authorized) throw new ValidationError('المشغل غير مؤهل لتشغيل هذه المعدة.', auth.reasons);
  }

  const hours = computeHours(data.log_date, data.start_time, data.end_time, data.hours);
  const uuid = randomUUID();
  const info = db.prepare(`
    INSERT INTO equipment_operation_logs
      (uuid, equipment_id, project_id, operator_id, log_date, start_time, end_time, hours, activity,
       productivity_qty, productivity_unit, fuel_used_l, start_hour_meter, end_hour_meter, notes, actor)
    VALUES (@uuid, @equipment_id, @project_id, @operator_id, @log_date, @start_time, @end_time, @hours, @activity,
       @productivity_qty, @productivity_unit, @fuel_used_l, @start_hour_meter, @end_hour_meter, @notes, @actor)
  `).run({
    uuid, equipment_id: data.equipment_id, project_id: data.project_id || equipment.current_project_id || null,
    operator_id: data.operator_id || null, log_date: data.log_date, start_time: data.start_time || null,
    end_time: data.end_time || null, hours, activity: data.activity || null,
    productivity_qty: data.productivity_qty ?? null, productivity_unit: data.productivity_unit || null,
    fuel_used_l: data.fuel_used_l ?? null, start_hour_meter: data.start_hour_meter ?? null,
    end_hour_meter: data.end_hour_meter ?? null, notes: data.notes || null, actor: actor || null,
  });

  if (data.end_hour_meter != null) {
    recordHourMeterReading(data.equipment_id, data.end_hour_meter, { source: 'operation_log', recordedBy: actor, readingDate: data.log_date });
  }

  writeAudit({ equipment_id: data.equipment_id, entity_type: 'operation_log', entity_id: info.lastInsertRowid, action: 'create', after: data, actor });
  return db.prepare(`SELECT * FROM equipment_operation_logs WHERE id = ?`).get(info.lastInsertRowid);
}

export function listOperationLogs({ equipment_id, project_id, operator_id, from, to, page = 1, pageSize = 20 } = {}) {
  const db = edb();
  const where = [];
  const params = {};
  if (equipment_id) { where.push('ol.equipment_id = @equipment_id'); params.equipment_id = equipment_id; }
  if (project_id) { where.push('ol.project_id = @project_id'); params.project_id = project_id; }
  if (operator_id) { where.push('ol.operator_id = @operator_id'); params.operator_id = operator_id; }
  if (from) { where.push('ol.log_date >= @from'); params.from = from; }
  if (to) { where.push('ol.log_date <= @to'); params.to = to; }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS n FROM equipment_operation_logs ol ${whereSql}`).get(params).n;
  const size = Math.min(200, Math.max(1, Number(pageSize) || 20));
  const offset = (Math.max(1, Number(page) || 1) - 1) * size;
  const rows = db.prepare(`
    SELECT ol.*, ea.name AS equipment_name, ea.equipment_code, op.name AS operator_name, p.name AS project_name
    FROM equipment_operation_logs ol
    LEFT JOIN equipment_assets ea ON ea.id = ol.equipment_id
    LEFT JOIN equipment_operators op ON op.id = ol.operator_id
    LEFT JOIN projects p ON p.id = ol.project_id
    ${whereSql} ORDER BY ol.log_date DESC, ol.created_at DESC LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: size, offset });
  return { rows, total, page: Math.max(1, Number(page) || 1), pageSize: size };
}

export function updateOperationLogNotes(id, { notes, activity, productivity_qty, productivity_unit }, actor) {
  const db = edb();
  const before = db.prepare(`SELECT * FROM equipment_operation_logs WHERE id = ?`).get(id);
  if (!before) throw new Error('سجل التشغيل غير موجود.');
  db.prepare(`
    UPDATE equipment_operation_logs SET notes = @notes, activity = @activity, productivity_qty = @productivity_qty, productivity_unit = @productivity_unit
    WHERE id = @id
  `).run({ id, notes: notes ?? before.notes, activity: activity ?? before.activity, productivity_qty: productivity_qty ?? before.productivity_qty, productivity_unit: productivity_unit ?? before.productivity_unit });
  const after = db.prepare(`SELECT * FROM equipment_operation_logs WHERE id = ?`).get(id);
  writeAudit({ equipment_id: before.equipment_id, entity_type: 'operation_log', entity_id: id, action: 'update_notes', before, after, actor });
  return after;
}

export function sumHours({ equipment_id, from, to }) {
  const db = edb();
  const params = { equipment_id, from: from || '0000-01-01', to: to || '9999-12-31' };
  const row = db.prepare(`SELECT COALESCE(SUM(hours), 0) AS total FROM equipment_operation_logs WHERE equipment_id = @equipment_id AND log_date >= @from AND log_date <= @to`).get(params);
  return Number(row.total) || 0;
}
