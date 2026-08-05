// lib/equipment/db/breakdowns.js
// سجل الأعطال (البند 12) - "حساب Downtime تلقائياً". عند فتح عطل تنتقل المعدة لحالة
// 'maintenance' تلقائياً (ما لم تكن خارج الخدمة أصلاً)، وتُستعاد تلقائياً عند إغلاق آخر
// مشكلة مفتوحة (صيانة أو عطل) عبر restoreStatusIfIdle المشتركة مع maintenance.js.
import { randomUUID } from 'crypto';
import { edb, BREAKDOWN_SEVERITIES } from '../schema.js';
import { ValidationError } from '../../calc/common.js';
import { writeAudit } from './audit.js';
import { usePart, listUsageFor } from './spareParts.js';
import { restoreStatusIfIdle, getEquipmentById } from './equipment.js';
import { createBudgetItem } from '../../pm/db/budget.js';
import { newBreakdownNotification } from '../notifications.js';
import { upsertNotification } from './notifications.js';

function nextReportNo(db) {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM equipment_breakdowns`).get();
  return `BRK-${String((row?.n || 0) + 1).padStart(6, '0')}`;
}

function computeDowntimeHours(stopTime, resumeTime) {
  if (!stopTime || !resumeTime) return 0;
  const s = new Date(stopTime).getTime();
  const r = new Date(resumeTime).getTime();
  if (Number.isNaN(s) || Number.isNaN(r) || r <= s) return 0;
  return Math.round(((r - s) / 3600000) * 100) / 100;
}

export function createBreakdown(data, actor) {
  if (!data.equipment_id || !data.description || !data.breakdown_date) {
    throw new ValidationError('بيانات العطل غير مكتملة.', ['المعدة ووصف العطل وتاريخه كلها مطلوبة.']);
  }
  if (data.severity && !BREAKDOWN_SEVERITIES.includes(data.severity)) {
    throw new ValidationError('درجة الخطورة غير صالحة.', [`القيم المسموحة: ${BREAKDOWN_SEVERITIES.join('، ')}.`]);
  }
  const db = edb();
  const equipment = getEquipmentById(data.equipment_id);
  if (!equipment) throw new Error('المعدة غير موجودة.');

  const uuid = randomUUID();
  const reportNo = nextReportNo(db);
  const info = db.prepare(`
    INSERT INTO equipment_breakdowns
      (uuid, report_no, equipment_id, project_id, breakdown_date, stop_time, description, cause, severity, responsible, status, actor)
    VALUES (@uuid, @report_no, @equipment_id, @project_id, @breakdown_date, @stop_time, @description, @cause, @severity, @responsible, 'open', @actor)
  `).run({
    uuid, report_no: reportNo, equipment_id: data.equipment_id, project_id: data.project_id || equipment.current_project_id || null,
    breakdown_date: data.breakdown_date, stop_time: data.stop_time || null, description: data.description,
    cause: data.cause || null, severity: data.severity || 'medium', responsible: data.responsible || null, actor: actor || null,
  });
  const breakdown = db.prepare(`SELECT * FROM equipment_breakdowns WHERE id = ?`).get(info.lastInsertRowid);

  if (equipment.status !== 'out_of_service') {
    db.prepare(`UPDATE equipment_assets SET status = 'maintenance', updated_at = datetime('now') WHERE id = ?`).run(data.equipment_id);
    db.prepare(`INSERT INTO equipment_status_log (equipment_id, old_status, new_status, note, actor) VALUES (?, ?, 'maintenance', ?, ?)`)
      .run(data.equipment_id, equipment.status, `عطل جديد: ${reportNo}`, actor || null);
  }

  upsertNotification(newBreakdownNotification(equipment, breakdown));
  writeAudit({ equipment_id: data.equipment_id, entity_type: 'breakdown', entity_id: breakdown.id, action: 'create', after: breakdown, actor });
  return breakdown;
}

export function updateBreakdownProgress(id, { status, corrective_action, responsible }, actor) {
  const db = edb();
  const before = db.prepare(`SELECT * FROM equipment_breakdowns WHERE id = ?`).get(id);
  if (!before) throw new Error('العطل غير موجود.');
  const newStatus = status && ['open', 'in_repair'].includes(status) ? status : before.status;
  db.prepare(`UPDATE equipment_breakdowns SET status = @status, corrective_action = @corrective_action, responsible = @responsible, updated_at = datetime('now') WHERE id = @id`)
    .run({ id, status: newStatus, corrective_action: corrective_action ?? before.corrective_action, responsible: responsible ?? before.responsible });
  const after = db.prepare(`SELECT * FROM equipment_breakdowns WHERE id = ?`).get(id);
  writeAudit({ equipment_id: before.equipment_id, entity_type: 'breakdown', entity_id: id, action: 'update', before, after, actor });
  return after;
}

export function resolveBreakdown(id, data, actor) {
  const db = edb();
  const before = db.prepare(`SELECT * FROM equipment_breakdowns WHERE id = ?`).get(id);
  if (!before) throw new Error('العطل غير موجود.');
  const equipment = getEquipmentById(before.equipment_id);

  const resumeTime = data.resume_time || new Date().toISOString();
  const downtime = computeDowntimeHours(before.stop_time, resumeTime);
  const laborCost = Number(data.labor_cost) || 0;

  let partsCost = 0;
  for (const p of data.parts || []) {
    const used = usePart(p.part_id, p.quantity, { breakdown_id: id, used_date: data.resolution_date || before.breakdown_date, actor });
    partsCost += used.totalCost;
  }
  const totalCost = Math.round((laborCost + partsCost) * 100) / 100;

  db.prepare(`
    UPDATE equipment_breakdowns SET status = 'resolved', resume_time = @resume_time, corrective_action = @corrective_action,
      labor_cost = @labor_cost, parts_cost = @parts_cost, total_cost = @total_cost, updated_at = datetime('now')
    WHERE id = @id
  `).run({ id, resume_time: resumeTime, corrective_action: data.corrective_action || before.corrective_action, labor_cost: laborCost, parts_cost: partsCost, total_cost: totalCost });

  restoreStatusIfIdle(before.equipment_id, actor, `إصلاح العطل ${before.report_no}`);

  if ((before.project_id || equipment?.current_project_id) && totalCost > 0) {
    try {
      createBudgetItem({
        project_id: before.project_id || equipment.current_project_id, item_type: 'expense', category: 'equipment_breakdown',
        description: `إصلاح عطل ${before.report_no} - ${equipment?.name || ''}`,
        amount: totalCost, date: data.resolution_date || before.breakdown_date, reference_no: `BRK-${id}`, actor,
      });
    } catch (e) { console.error('[equipment] فشل ربط تكلفة إصلاح العطل بالميزانية:', e.message); }
  }

  const after = db.prepare(`SELECT * FROM equipment_breakdowns WHERE id = ?`).get(id);
  writeAudit({ equipment_id: before.equipment_id, entity_type: 'breakdown', entity_id: id, action: 'resolve', before, after, actor });
  return { ...after, parts_used: listUsageFor({ breakdown_id: id }) };
}

export function listBreakdowns({ equipment_id, status, severity, from, to, page = 1, pageSize = 20 } = {}) {
  const db = edb();
  const where = [];
  const params = {};
  if (equipment_id) { where.push('b.equipment_id = @equipment_id'); params.equipment_id = equipment_id; }
  if (status) { where.push('b.status = @status'); params.status = status; }
  if (severity) { where.push('b.severity = @severity'); params.severity = severity; }
  if (from) { where.push('b.breakdown_date >= @from'); params.from = from; }
  if (to) { where.push('b.breakdown_date <= @to'); params.to = to; }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS n FROM equipment_breakdowns b ${whereSql}`).get(params).n;
  const size = Math.min(200, Math.max(1, Number(pageSize) || 20));
  const offset = (Math.max(1, Number(page) || 1) - 1) * size;
  const rows = db.prepare(`
    SELECT b.*, ea.name AS equipment_name, ea.equipment_code
    FROM equipment_breakdowns b LEFT JOIN equipment_assets ea ON ea.id = b.equipment_id
    ${whereSql} ORDER BY b.breakdown_date DESC, b.created_at DESC LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: size, offset });
  return { rows, total, page: Math.max(1, Number(page) || 1), pageSize: size };
}

export function getBreakdownById(id) {
  const db = edb();
  const row = db.prepare(`SELECT * FROM equipment_breakdowns WHERE id = ?`).get(id);
  if (!row) return null;
  return { ...row, parts_used: listUsageFor({ breakdown_id: id }) };
}

export function listOpenBreakdowns() {
  return edb().prepare(`SELECT b.*, ea.name AS equipment_name FROM equipment_breakdowns b LEFT JOIN equipment_assets ea ON ea.id = b.equipment_id WHERE b.status != 'resolved' ORDER BY b.breakdown_date`).all();
}

export function sumBreakdownCost({ equipment_id, from, to }) {
  const db = edb();
  const params = { equipment_id, from: from || '0000-01-01', to: to || '9999-12-31' };
  const row = db.prepare(`SELECT COALESCE(SUM(total_cost), 0) AS cost FROM equipment_breakdowns WHERE equipment_id = @equipment_id AND breakdown_date >= @from AND breakdown_date <= @to`).get(params);
  return Number(row.cost) || 0;
}
