// lib/equipment/db/dashboard.js
// لوحة التحكم الرئيسية (البند 1، 20) - تجميع حقيقي من كل الجداول، بلا أي رقم ثابت.
import { edb } from '../schema.js';
import { listDueSchedules } from './maintenance.js';

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

export function getDashboardStats() {
  const db = edb();

  const statusRows = db.prepare(`SELECT status, COUNT(*) AS n FROM equipment_assets WHERE is_archived = 0 GROUP BY status`).all();
  const statusCounts = Object.fromEntries(statusRows.map((r) => [r.status, r.n]));
  const totalEquipment = db.prepare(`SELECT COUNT(*) AS n FROM equipment_assets WHERE is_archived = 0`).get().n;
  const rentedCount = db.prepare(`SELECT COUNT(*) AS n FROM equipment_assets WHERE is_archived = 0 AND ownership_type = 'rented'`).get().n;

  const totalHours = db.prepare(`SELECT COALESCE(SUM(hours), 0) AS h FROM equipment_operation_logs`).get().h;
  const fuelAgg = db.prepare(`SELECT COALESCE(SUM(total_cost), 0) AS cost, COALESCE(SUM(quantity_l), 0) AS liters FROM equipment_fuel_logs`).get();
  const maintenanceCost = db.prepare(`SELECT COALESCE(SUM(total_cost), 0) AS c FROM equipment_maintenance_records`).get().c;
  const breakdownCost = db.prepare(`SELECT COALESCE(SUM(total_cost), 0) AS c FROM equipment_breakdowns`).get().c;
  const rentalCost = db.prepare(`SELECT COALESCE(SUM(rental_cost_total), 0) AS c FROM equipment_rentals WHERE contract_status = 'active'`).get().c;
  const totalOperatingCost = round2(Number(fuelAgg.cost) + Number(rentalCost));
  const totalMaintenanceCost = round2(Number(maintenanceCost) + Number(breakdownCost));

  const avgFuelRate = totalHours > 0 ? round2(Number(fuelAgg.liters) / totalHours) : 0;
  const breakdownCount = db.prepare(`SELECT COUNT(*) AS n FROM equipment_breakdowns`).get().n;
  const openBreakdownCount = db.prepare(`SELECT COUNT(*) AS n FROM equipment_breakdowns WHERE status != 'resolved'`).get().n;
  const maintenanceCount = db.prepare(`SELECT COUNT(*) AS n FROM equipment_maintenance_records`).get().n;

  const activeCount = (statusCounts.in_use || 0) + (statusCounts.available || 0) + (statusCounts.reserved || 0);
  const last30Hours = db.prepare(`SELECT COALESCE(SUM(hours), 0) AS h FROM equipment_operation_logs WHERE log_date >= date('now', '-30 days')`).get().h;
  const avgUtilization = activeCount > 0 ? round2((Number(last30Hours) / (activeCount * 30 * 8)) * 100) : 0;

  const recentOperations = db.prepare(`
    SELECT ol.id, ol.log_date, ol.hours, ol.activity, ea.name AS equipment_name, ea.equipment_code, op.name AS operator_name
    FROM equipment_operation_logs ol LEFT JOIN equipment_assets ea ON ea.id = ol.equipment_id LEFT JOIN equipment_operators op ON op.id = ol.operator_id
    ORDER BY ol.created_at DESC LIMIT 8
  `).all();
  const recentMaintenance = db.prepare(`
    SELECT m.id, m.maintenance_date, m.title, m.maintenance_type, m.total_cost, ea.name AS equipment_name, ea.equipment_code
    FROM equipment_maintenance_records m LEFT JOIN equipment_assets ea ON ea.id = m.equipment_id ORDER BY m.created_at DESC LIMIT 8
  `).all();
  const recentBreakdowns = db.prepare(`
    SELECT b.id, b.report_no, b.breakdown_date, b.description, b.severity, b.status, ea.name AS equipment_name
    FROM equipment_breakdowns b LEFT JOIN equipment_assets ea ON ea.id = b.equipment_id ORDER BY b.created_at DESC LIMIT 8
  `).all();

  const upcomingMaintenance = listDueSchedules().slice(0, 10);

  const monthlyHours = db.prepare(`
    SELECT strftime('%Y-%m', log_date) AS ym, ROUND(SUM(hours), 1) AS hours FROM equipment_operation_logs
    WHERE log_date >= date('now', '-6 months') GROUP BY ym ORDER BY ym
  `).all();
  const monthlyCosts = db.prepare(`
    SELECT ym, ROUND(SUM(c), 2) AS cost FROM (
      SELECT strftime('%Y-%m', fill_date) AS ym, total_cost AS c FROM equipment_fuel_logs WHERE fill_date >= date('now', '-6 months')
      UNION ALL
      SELECT strftime('%Y-%m', maintenance_date) AS ym, total_cost AS c FROM equipment_maintenance_records WHERE maintenance_date >= date('now', '-6 months')
      UNION ALL
      SELECT strftime('%Y-%m', breakdown_date) AS ym, total_cost AS c FROM equipment_breakdowns WHERE breakdown_date >= date('now', '-6 months')
    ) GROUP BY ym ORDER BY ym
  `).all();

  const byCategoryGroup = db.prepare(`
    SELECT ec.group_key, ec.group_label_ar, COUNT(*) AS n FROM equipment_assets ea
    LEFT JOIN equipment_categories ec ON ec.key = ea.category_key
    WHERE ea.is_archived = 0 GROUP BY ec.group_key ORDER BY n DESC
  `).all();

  return {
    total_equipment: totalEquipment,
    working_equipment: statusCounts.in_use || 0,
    stopped_equipment: statusCounts.stopped || 0,
    maintenance_equipment: statusCounts.maintenance || 0,
    reserved_equipment: statusCounts.reserved || 0,
    available_equipment: statusCounts.available || 0,
    out_of_service_equipment: statusCounts.out_of_service || 0,
    rented_equipment: rentedCount,
    total_operating_hours: round2(totalHours),
    total_operating_cost: totalOperatingCost,
    total_maintenance_cost: totalMaintenanceCost,
    avg_fuel_rate_l_per_hour: avgFuelRate,
    breakdown_count: breakdownCount,
    open_breakdown_count: openBreakdownCount,
    maintenance_count: maintenanceCount,
    avg_utilization_pct: avgUtilization,
    recent_operations: recentOperations,
    recent_maintenance: recentMaintenance,
    recent_breakdowns: recentBreakdowns,
    upcoming_maintenance: upcomingMaintenance,
    monthly_hours_chart: monthlyHours,
    monthly_cost_chart: monthlyCosts,
    by_category_group: byCategoryGroup,
  };
}
