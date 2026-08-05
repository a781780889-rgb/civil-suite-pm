// lib/equipment/db/fuel.js
// إدارة الوقود (البند 9) - سجل ملحق فقط (Append-only، لا حذف - نفس مبدأ operations.js).
// يحسب التكلفة تلقائياً، يكتشف الاستهلاك غير الطبيعي، ويربط التكلفة الفعلية بميزانية
// المشروع الحقيقية (البند 22: "تشغيل معدة → تحديث التكلفة → تظهر في ميزانية المشروع").
import { randomUUID } from 'crypto';
import { edb } from '../schema.js';
import { ValidationError } from '../../calc/common.js';
import { writeAudit } from './audit.js';
import { computeFuelEfficiency } from '../costCalc.js';
import { highFuelConsumptionNotification } from '../notifications.js';
import { upsertNotification } from './notifications.js';
import { createBudgetItem } from '../../pm/db/budget.js';
import { sumHours } from './operations.js';

const ANOMALY_THRESHOLD_PCT = 20; // انحراف يتجاوز 20% عن المعدل المرجعي يُعتبر استهلاكاً غير طبيعي

export function createFuelLog(data, actor) {
  if (!data.equipment_id || !data.fill_date || data.quantity_l == null) {
    throw new ValidationError('بيانات تعبئة الوقود غير مكتملة.', ['المعدة وتاريخ التعبئة والكمية حقول مطلوبة.']);
  }
  const db = edb();
  const equipment = db.prepare(`SELECT * FROM equipment_assets WHERE id = ?`).get(data.equipment_id);
  if (!equipment) throw new Error('المعدة غير موجودة.');

  const quantity = Number(data.quantity_l);
  const price = Number(data.price_per_liter) || 0;
  const totalCost = data.total_cost != null ? Number(data.total_cost) : Math.round(quantity * price * 100) / 100;
  const uuid = randomUUID();
  const projectId = data.project_id || equipment.current_project_id || null;

  const info = db.prepare(`
    INSERT INTO equipment_fuel_logs
      (uuid, equipment_id, project_id, operator_id, fill_date, quantity_l, fuel_type, price_per_liter, total_cost, hour_meter_reading, supplier, operation_no, notes, actor)
    VALUES (@uuid, @equipment_id, @project_id, @operator_id, @fill_date, @quantity_l, @fuel_type, @price_per_liter, @total_cost, @hour_meter_reading, @supplier, @operation_no, @notes, @actor)
  `).run({
    uuid, equipment_id: data.equipment_id, project_id: projectId, operator_id: data.operator_id || null,
    fill_date: data.fill_date, quantity_l: quantity, fuel_type: data.fuel_type || equipment.fuel_type || null,
    price_per_liter: price, total_cost: totalCost, hour_meter_reading: data.hour_meter_reading ?? null,
    supplier: data.supplier || null, operation_no: data.operation_no || null, notes: data.notes || null, actor: actor || null,
  });
  const fuelLog = db.prepare(`SELECT * FROM equipment_fuel_logs WHERE id = ?`).get(info.lastInsertRowid);

  if (projectId && totalCost > 0) {
    try {
      createBudgetItem({
        project_id: projectId, item_type: 'expense', category: 'equipment_fuel',
        description: `وقود - ${equipment.name} (${equipment.equipment_code})`,
        amount: totalCost, date: data.fill_date, reference_no: `FUEL-${fuelLog.id}`, actor,
      });
    } catch (e) { console.error('[equipment] فشل ربط تكلفة الوقود بالميزانية:', e.message); }
  }

  if (equipment.rated_consumption_l_per_hour) {
    const last30 = db.prepare(`
      SELECT COALESCE(SUM(quantity_l), 0) AS l FROM equipment_fuel_logs
      WHERE equipment_id = ? AND fill_date >= date(?, '-30 days')
    `).get(data.equipment_id, data.fill_date).l;
    const hours30 = sumHours({ equipment_id: data.equipment_id, from: '0000-01-01', to: data.fill_date });
    const { deviation_pct } = computeFuelEfficiency(last30, hours30 || 1, equipment.rated_consumption_l_per_hour);
    if (deviation_pct != null && deviation_pct > ANOMALY_THRESHOLD_PCT) {
      upsertNotification(highFuelConsumptionNotification(equipment, fuelLog, deviation_pct));
    }
  }

  writeAudit({ equipment_id: data.equipment_id, entity_type: 'fuel_log', entity_id: fuelLog.id, action: 'create', after: fuelLog, actor });
  return fuelLog;
}

export function listFuelLogs({ equipment_id, project_id, from, to, page = 1, pageSize = 20 } = {}) {
  const db = edb();
  const where = [];
  const params = {};
  if (equipment_id) { where.push('fl.equipment_id = @equipment_id'); params.equipment_id = equipment_id; }
  if (project_id) { where.push('fl.project_id = @project_id'); params.project_id = project_id; }
  if (from) { where.push('fl.fill_date >= @from'); params.from = from; }
  if (to) { where.push('fl.fill_date <= @to'); params.to = to; }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS n FROM equipment_fuel_logs fl ${whereSql}`).get(params).n;
  const size = Math.min(200, Math.max(1, Number(pageSize) || 20));
  const offset = (Math.max(1, Number(page) || 1) - 1) * size;
  const rows = db.prepare(`
    SELECT fl.*, ea.name AS equipment_name, ea.equipment_code, p.name AS project_name
    FROM equipment_fuel_logs fl
    LEFT JOIN equipment_assets ea ON ea.id = fl.equipment_id
    LEFT JOIN projects p ON p.id = fl.project_id
    ${whereSql} ORDER BY fl.fill_date DESC, fl.created_at DESC LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: size, offset });
  return { rows, total, page: Math.max(1, Number(page) || 1), pageSize: size };
}

export function sumFuelCost({ equipment_id, from, to }) {
  const db = edb();
  const params = { equipment_id, from: from || '0000-01-01', to: to || '9999-12-31' };
  const row = db.prepare(`SELECT COALESCE(SUM(total_cost), 0) AS cost, COALESCE(SUM(quantity_l), 0) AS liters FROM equipment_fuel_logs WHERE equipment_id = @equipment_id AND fill_date >= @from AND fill_date <= @to`).get(params);
  return { cost: Number(row.cost) || 0, liters: Number(row.liters) || 0 };
}
