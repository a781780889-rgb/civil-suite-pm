// lib/equipment/db/maintenance.js
// الصيانة الوقائية والتصحيحية (البند 10-11) - جدول خطط الصيانة الدورية + سجل التنفيذ الفعلي.
// عند اكتمال صيانة وقائية مرتبطة بجدول، يُعاد حساب next_due تلقائياً (البند 11: "إنشاء جدول
// صيانة يعتمد على ساعات التشغيل/التاريخ... وإرسال تنبيه عند اقتراب موعد الصيانة").
import { randomUUID } from 'crypto';
import { edb, MAINTENANCE_TYPES } from '../schema.js';
import { ValidationError } from '../../calc/common.js';
import { writeAudit } from './audit.js';
import { usePart, listUsageFor } from './spareParts.js';
import { restoreStatusIfIdle, getEquipmentById } from './equipment.js';
import { createBudgetItem } from '../../pm/db/budget.js';

// ---------------------------- خطط الصيانة الدورية (Schedules) ----------------------------

function computeNextDue(schedule) {
  const next = { next_due_date: schedule.next_due_date, next_due_hour_meter: schedule.next_due_hour_meter };
  if (schedule.interval_type === 'hours' && schedule.interval_hours) {
    const base = Number(schedule.last_done_hour_meter) || 0;
    next.next_due_hour_meter = base + Number(schedule.interval_hours);
  }
  if (schedule.interval_type === 'days' && schedule.interval_days) {
    const base = schedule.last_done_date ? new Date(schedule.last_done_date) : new Date();
    base.setDate(base.getDate() + Number(schedule.interval_days));
    next.next_due_date = base.toISOString().slice(0, 10);
  }
  return next;
}

export function createSchedule(data, actor) {
  if (!data.title || (!data.equipment_id && !data.category_key)) {
    throw new ValidationError('بيانات جدول الصيانة غير مكتملة.', ['العنوان، ومعدة أو تصنيف واحد على الأقل، مطلوبة.']);
  }
  const db = edb();
  const uuid = randomUUID();
  const base = {
    equipment_id: data.equipment_id || null, category_key: data.category_key || null, title: data.title,
    maintenance_items: JSON.stringify(data.maintenance_items || []), interval_type: data.interval_type || 'hours',
    interval_hours: data.interval_hours ?? null, interval_days: data.interval_days ?? null,
    last_done_hour_meter: data.last_done_hour_meter ?? null, last_done_date: data.last_done_date ?? null,
  };
  const due = computeNextDue(base);
  const info = db.prepare(`
    INSERT INTO equipment_maintenance_schedules
      (uuid, equipment_id, category_key, title, maintenance_items, interval_type, interval_hours, interval_days,
       last_done_hour_meter, last_done_date, next_due_hour_meter, next_due_date, is_active, notes, actor)
    VALUES (@uuid, @equipment_id, @category_key, @title, @maintenance_items, @interval_type, @interval_hours, @interval_days,
       @last_done_hour_meter, @last_done_date, @next_due_hour_meter, @next_due_date, 1, @notes, @actor)
  `).run({ uuid, ...base, ...due, notes: data.notes || null, actor: actor || null });
  const schedule = db.prepare(`SELECT * FROM equipment_maintenance_schedules WHERE id = ?`).get(info.lastInsertRowid);
  writeAudit({ equipment_id: data.equipment_id || null, entity_type: 'maintenance_schedule', entity_id: schedule.id, action: 'create', after: schedule, actor });
  return schedule;
}

export function listSchedules({ equipment_id, category_key, is_active = true } = {}) {
  const db = edb();
  const where = [];
  const params = {};
  if (equipment_id) { where.push('equipment_id = @equipment_id'); params.equipment_id = equipment_id; }
  if (category_key) { where.push('category_key = @category_key'); params.category_key = category_key; }
  if (is_active != null) { where.push('is_active = @is_active'); params.is_active = is_active ? 1 : 0; }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return db.prepare(`SELECT * FROM equipment_maintenance_schedules ${whereSql} ORDER BY next_due_date IS NULL, next_due_date, next_due_hour_meter`).all(params);
}

export function updateSchedule(id, data, actor) {
  const db = edb();
  const before = db.prepare(`SELECT * FROM equipment_maintenance_schedules WHERE id = ?`).get(id);
  if (!before) throw new Error('جدول الصيانة غير موجود.');
  const fields = ['title', 'maintenance_items', 'interval_type', 'interval_hours', 'interval_days', 'last_done_hour_meter', 'last_done_date', 'next_due_hour_meter', 'next_due_date', 'is_active', 'notes'];
  const merged = { ...before };
  for (const f of fields) if (f in data) merged[f] = f === 'maintenance_items' && Array.isArray(data[f]) ? JSON.stringify(data[f]) : data[f];
  const setSql = fields.map((f) => `${f} = @${f}`).join(', ');
  db.prepare(`UPDATE equipment_maintenance_schedules SET ${setSql}, updated_at = datetime('now') WHERE id = @id`).run({ id, ...Object.fromEntries(fields.map((f) => [f, merged[f]])) });
  const after = db.prepare(`SELECT * FROM equipment_maintenance_schedules WHERE id = ?`).get(id);
  writeAudit({ equipment_id: before.equipment_id, entity_type: 'maintenance_schedule', entity_id: id, action: 'update', before, after, actor });
  return after;
}

export function deactivateSchedule(id, actor) {
  edb().prepare(`UPDATE equipment_maintenance_schedules SET is_active = 0, updated_at = datetime('now') WHERE id = ?`).run(id);
  writeAudit({ entity_type: 'maintenance_schedule', entity_id: id, action: 'deactivate', actor });
  return { deactivated: true };
}

/** يفحص كل الجداول النشطة ويعيد ما استحقّ فعلاً (بالتاريخ أو ساعات التشغيل) - يغذّي notificationsScan.js. */
export function listDueSchedules() {
  const db = edb();
  const today = new Date().toISOString().slice(0, 10);
  const rows = db.prepare(`
    SELECT s.*, ea.name AS equipment_name, ea.current_hour_meter, ea.id AS eq_id
    FROM equipment_maintenance_schedules s
    LEFT JOIN equipment_assets ea ON ea.id = s.equipment_id
    WHERE s.is_active = 1 AND (
      (s.next_due_date IS NOT NULL AND s.next_due_date <= date(?, '+7 days'))
      OR (s.next_due_hour_meter IS NOT NULL AND ea.current_hour_meter IS NOT NULL AND ea.current_hour_meter >= s.next_due_hour_meter - 20)
    )
  `).all(today);
  return rows;
}

// ---------------------------- سجلات الصيانة الفعلية (Records) ----------------------------

export function createMaintenanceRecord(data, actor) {
  if (!data.equipment_id || !data.title || !data.maintenance_date) {
    throw new ValidationError('بيانات سجل الصيانة غير مكتملة.', ['المعدة والعنوان وتاريخ الصيانة كلها مطلوبة.']);
  }
  if (data.maintenance_type && !MAINTENANCE_TYPES.includes(data.maintenance_type)) {
    throw new ValidationError('نوع الصيانة غير صالح.', [`القيم المسموحة: ${MAINTENANCE_TYPES.join('، ')}.`]);
  }
  const db = edb();
  const equipment = getEquipmentById(data.equipment_id);
  if (!equipment) throw new Error('المعدة غير موجودة.');

  const status = data.status || 'completed';
  const uuid = randomUUID();
  const laborCost = Number(data.labor_cost) || 0;
  const info = db.prepare(`
    INSERT INTO equipment_maintenance_records
      (uuid, equipment_id, schedule_id, project_id, maintenance_type, title, description, maintenance_date,
       hour_meter_at_service, technician, labor_cost, parts_cost, total_cost, downtime_hours, status, actor)
    VALUES (@uuid, @equipment_id, @schedule_id, @project_id, @maintenance_type, @title, @description, @maintenance_date,
       @hour_meter_at_service, @technician, @labor_cost, 0, @labor_cost, @downtime_hours, @status, @actor)
  `).run({
    uuid, equipment_id: data.equipment_id, schedule_id: data.schedule_id || null,
    project_id: data.project_id || equipment.current_project_id || null,
    maintenance_type: data.maintenance_type || 'preventive', title: data.title, description: data.description || null,
    maintenance_date: data.maintenance_date, hour_meter_at_service: data.hour_meter_at_service ?? equipment.current_hour_meter,
    technician: data.technician || null, labor_cost: laborCost, downtime_hours: Number(data.downtime_hours) || 0,
    status, actor: actor || null,
  });
  const recordId = info.lastInsertRowid;

  let partsCost = 0;
  for (const p of data.parts || []) {
    const used = usePart(p.part_id, p.quantity, { maintenance_record_id: recordId, used_date: data.maintenance_date, actor });
    partsCost += used.totalCost;
  }
  const totalCost = Math.round((laborCost + partsCost) * 100) / 100;
  db.prepare(`UPDATE equipment_maintenance_records SET parts_cost = ?, total_cost = ? WHERE id = ?`).run(partsCost, totalCost, recordId);

  if (data.schedule_id) {
    const schedule = db.prepare(`SELECT * FROM equipment_maintenance_schedules WHERE id = ?`).get(data.schedule_id);
    if (schedule) {
      const merged = { ...schedule, last_done_date: data.maintenance_date, last_done_hour_meter: data.hour_meter_at_service ?? equipment.current_hour_meter };
      const due = computeNextDue(merged);
      db.prepare(`UPDATE equipment_maintenance_schedules SET last_done_date = @last_done_date, last_done_hour_meter = @last_done_hour_meter, next_due_date = @next_due_date, next_due_hour_meter = @next_due_hour_meter, updated_at = datetime('now') WHERE id = @id`)
        .run({ id: data.schedule_id, last_done_date: merged.last_done_date, last_done_hour_meter: merged.last_done_hour_meter, ...due });
    }
  }

  if (status === 'in_progress' || status === 'scheduled') {
    if (!['out_of_service'].includes(equipment.status)) {
      db.prepare(`UPDATE equipment_assets SET status = 'maintenance', updated_at = datetime('now') WHERE id = ?`).run(data.equipment_id);
      db.prepare(`INSERT INTO equipment_status_log (equipment_id, old_status, new_status, note, actor) VALUES (?, ?, 'maintenance', 'بدء صيانة', ?)`).run(data.equipment_id, equipment.status, actor || null);
    }
  } else if (status === 'completed') {
    restoreStatusIfIdle(data.equipment_id, actor, 'اكتمال الصيانة');
  }

  if ((data.project_id || equipment.current_project_id) && totalCost > 0) {
    try {
      createBudgetItem({
        project_id: data.project_id || equipment.current_project_id, item_type: 'expense', category: 'equipment_maintenance',
        description: `صيانة ${data.maintenance_type === 'corrective' ? 'تصحيحية' : 'وقائية'} - ${equipment.name} (${equipment.equipment_code}): ${data.title}`,
        amount: totalCost, date: data.maintenance_date, reference_no: `MAINT-${recordId}`, actor,
      });
    } catch (e) { console.error('[equipment] فشل ربط تكلفة الصيانة بالميزانية:', e.message); }
  }

  const record = db.prepare(`SELECT * FROM equipment_maintenance_records WHERE id = ?`).get(recordId);
  writeAudit({ equipment_id: data.equipment_id, entity_type: 'maintenance_record', entity_id: recordId, action: 'create', after: record, actor });
  return { ...record, parts_used: listUsageFor({ maintenance_record_id: recordId }) };
}

export function completeMaintenanceRecord(id, { downtime_hours, description } = {}, actor) {
  const db = edb();
  const before = db.prepare(`SELECT * FROM equipment_maintenance_records WHERE id = ?`).get(id);
  if (!before) throw new Error('سجل الصيانة غير موجود.');
  db.prepare(`
    UPDATE equipment_maintenance_records SET status = 'completed', downtime_hours = @downtime_hours, description = @description, updated_at = datetime('now')
    WHERE id = @id
  `).run({ id, downtime_hours: downtime_hours ?? before.downtime_hours, description: description ?? before.description });
  restoreStatusIfIdle(before.equipment_id, actor, 'اكتمال الصيانة');
  const after = db.prepare(`SELECT * FROM equipment_maintenance_records WHERE id = ?`).get(id);
  writeAudit({ equipment_id: before.equipment_id, entity_type: 'maintenance_record', entity_id: id, action: 'complete', before, after, actor });
  return after;
}

export function listMaintenanceRecords({ equipment_id, maintenance_type, status, from, to, page = 1, pageSize = 20 } = {}) {
  const db = edb();
  const where = [];
  const params = {};
  if (equipment_id) { where.push('m.equipment_id = @equipment_id'); params.equipment_id = equipment_id; }
  if (maintenance_type) { where.push('m.maintenance_type = @maintenance_type'); params.maintenance_type = maintenance_type; }
  if (status) { where.push('m.status = @status'); params.status = status; }
  if (from) { where.push('m.maintenance_date >= @from'); params.from = from; }
  if (to) { where.push('m.maintenance_date <= @to'); params.to = to; }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS n FROM equipment_maintenance_records m ${whereSql}`).get(params).n;
  const size = Math.min(200, Math.max(1, Number(pageSize) || 20));
  const offset = (Math.max(1, Number(page) || 1) - 1) * size;
  const rows = db.prepare(`
    SELECT m.*, ea.name AS equipment_name, ea.equipment_code
    FROM equipment_maintenance_records m LEFT JOIN equipment_assets ea ON ea.id = m.equipment_id
    ${whereSql} ORDER BY m.maintenance_date DESC LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: size, offset });
  return { rows, total, page: Math.max(1, Number(page) || 1), pageSize: size };
}

export function getMaintenanceRecordById(id) {
  const db = edb();
  const record = db.prepare(`SELECT * FROM equipment_maintenance_records WHERE id = ?`).get(id);
  if (!record) return null;
  return { ...record, parts_used: listUsageFor({ maintenance_record_id: id }) };
}

export function sumMaintenanceCost({ equipment_id, from, to }) {
  const db = edb();
  const params = { equipment_id, from: from || '0000-01-01', to: to || '9999-12-31' };
  const row = db.prepare(`SELECT COALESCE(SUM(total_cost), 0) AS cost FROM equipment_maintenance_records WHERE equipment_id = @equipment_id AND maintenance_date >= @from AND maintenance_date <= @to`).get(params);
  return Number(row.cost) || 0;
}
