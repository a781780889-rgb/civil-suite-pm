// lib/equipment/db/costs.js
// تكلفة كل معدة على حدة ومؤشرات أدائها (KPI) - البند 16، 19. يجمع الاستعلامات الفعلية من
// كل الوحدات ثم يمرّرها لدوال الحساب النقية في costCalc.js (فصل الاستعلام عن الحساب).
import { edb } from '../schema.js';
import { getEquipmentById } from './equipment.js';
import { sumHours } from './operations.js';
import { sumFuelCost } from './fuel.js';
import { sumMaintenanceCost } from './maintenance.js';
import { sumBreakdownCost } from './breakdowns.js';
import {
  computeStraightLineDepreciation, computeCostPerHour, computeMTTR, computeMTBF,
  computeUtilizationRate, computeTotalCost,
} from '../costCalc.js';

export function computeEquipmentCostSummary(equipmentId, { from, to } = {}) {
  const db = edb();
  const equipment = getEquipmentById(equipmentId);
  if (!equipment) throw new Error('المعدة غير موجودة.');

  const totalHours = sumHours({ equipment_id: equipmentId, from, to });
  const { cost: fuelCost, liters: fuelLiters } = sumFuelCost({ equipment_id: equipmentId, from, to });
  const maintenanceCost = sumMaintenanceCost({ equipment_id: equipmentId, from, to });
  const breakdownCost = sumBreakdownCost({ equipment_id: equipmentId, from, to });
  const rentalCost = db.prepare(`SELECT COALESCE(SUM(rental_cost_total), 0) AS c FROM equipment_rentals WHERE equipment_id = ?`).get(equipmentId).c;
  const transferCost = db.prepare(`SELECT COALESCE(SUM(cost), 0) AS c FROM equipment_transfers WHERE equipment_id = ?`).get(equipmentId).c;
  const depreciation = computeStraightLineDepreciation(equipment);

  const totalCost = computeTotalCost({
    depreciation: depreciation.accumulated_depreciation, fuel: fuelCost, maintenance: maintenanceCost,
    spareParts: 0, rental: rentalCost, transfer: transferCost,
  });

  const breakdowns = db.prepare(`SELECT downtime_hours FROM equipment_breakdowns WHERE equipment_id = ?`).all(equipmentId);
  const breakdownCount = breakdowns.length;
  const mttr = computeMTTR(breakdowns);
  const mtbf = computeMTBF(totalHours, breakdownCount);

  return {
    equipment_id: equipmentId, total_hours: totalHours, fuel_cost: fuelCost, fuel_liters: fuelLiters,
    maintenance_cost: maintenanceCost, breakdown_cost: breakdownCost, rental_cost: rentalCost, transfer_cost: transferCost,
    depreciation, total_cost: totalCost, cost_per_hour: computeCostPerHour(totalCost, totalHours),
    mttr_hours: mttr, mtbf_hours: mtbf, breakdown_count: breakdownCount,
  };
}

/** نسبة الاستغلال لمعدة خلال فترة، مقارنة بساعات عمل نظرية (8 ساعات/يوم) - تقدير موثّق كتقريب صريح. */
export function computeEquipmentUtilization(equipmentId, fromDate, toDate) {
  const totalHours = sumHours({ equipment_id: equipmentId, from: fromDate, to: toDate });
  const days = Math.max(1, Math.round((new Date(toDate) - new Date(fromDate)) / 86400000));
  const availableHours = days * 8;
  return { total_hours: totalHours, available_hours: availableHours, utilization_pct: computeUtilizationRate(totalHours, availableHours) };
}
