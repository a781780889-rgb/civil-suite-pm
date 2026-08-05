// lib/equipment/notificationsScan.js
// يُشغَّل عند كل طلب GET لتنبيهات القسم (نفس أسلوب lib/business/notificationsScan.js) بدل
// Background Job حقيقي - شفافية كاملة بهذا الاختيار (البند 27 يذكر Background Jobs للعمليات
// الثقيلة؛ هذا القسم لا يزال بلا Queue حقيقي، تماماً كبقية المنصة حتى الآن). البند 23: التنبيهات.
import { edb } from './schema.js';
import { listDueSchedules } from './db/maintenance.js';
import { listOpenBreakdowns } from './db/breakdowns.js';
import { listExpiringRentals } from './db/rentals.js';
import { upsertNotification } from './db/notifications.js';
import {
  maintenanceDueNotification, warrantyExpiryNotification, insuranceExpiryNotification,
  overdueRepairNotification, hoursExceededNotification, operatorLicenseExpiryNotification,
  rentalExpiryNotification, lowStockNotification, prolongedStopNotification,
} from './notifications.js';

const OVERDUE_REPAIR_DAYS = 3;
const LICENSE_WARNING_DAYS = 30;
const PROLONGED_STOP_DAYS = 14;

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

export function runEquipmentNotificationScan() {
  const db = edb();
  let created = 0;
  const bump = (n) => { if (n != null) created += 1; };

  // صيانة مستحقة/تجاوزت الحد
  for (const s of listDueSchedules()) {
    const equipment = { id: s.eq_id || s.equipment_id, name: s.equipment_name, current_project_id: null, current_hour_meter: s.current_hour_meter };
    if (s.next_due_hour_meter != null && s.current_hour_meter != null && s.current_hour_meter >= s.next_due_hour_meter) {
      bump(upsertNotification(hoursExceededNotification(equipment, s)));
    } else {
      bump(upsertNotification(maintenanceDueNotification(equipment, s)));
    }
  }

  // ضمان/تأمين على وشك الانتهاء (خلال 30 يوماً)
  const soon = db.prepare(`
    SELECT * FROM equipment_assets WHERE is_archived = 0 AND (
      (warranty_expiry IS NOT NULL AND warranty_expiry <= date('now', '+30 days')) OR
      (insurance_expiry IS NOT NULL AND insurance_expiry <= date('now', '+30 days'))
    )
  `).all();
  for (const eq of soon) {
    if (eq.warranty_expiry && eq.warranty_expiry <= new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)) {
      bump(upsertNotification(warrantyExpiryNotification(eq)));
    }
    if (eq.insurance_expiry && eq.insurance_expiry <= new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)) {
      bump(upsertNotification(insuranceExpiryNotification(eq)));
    }
  }

  // أعطال متأخرة الإصلاح
  for (const b of listOpenBreakdowns()) {
    const daysOpen = daysBetween(b.breakdown_date, new Date().toISOString().slice(0, 10));
    if (daysOpen >= OVERDUE_REPAIR_DAYS) {
      bump(upsertNotification(overdueRepairNotification({ id: b.equipment_id, name: b.equipment_name, current_project_id: b.project_id }, b, daysOpen)));
    }
  }

  // رخص مشغلين قاربت الانتهاء
  const operators = db.prepare(`SELECT * FROM equipment_operators WHERE is_active = 1 AND license_expiry IS NOT NULL AND license_expiry <= date('now', '+' || ? || ' days')`).all(LICENSE_WARNING_DAYS);
  for (const op of operators) bump(upsertNotification(operatorLicenseExpiryNotification(op)));

  // عقود إيجار قاربت الانتهاء
  for (const r of listExpiringRentals(14)) {
    bump(upsertNotification(rentalExpiryNotification({ id: r.equipment_id, name: r.equipment_name, current_project_id: null }, r)));
  }

  // قطع غيار منخفضة المخزون
  const lowParts = db.prepare(`SELECT * FROM equipment_spare_parts WHERE quantity_on_hand <= min_stock`).all();
  for (const p of lowParts) bump(upsertNotification(lowStockNotification(p)));

  // معدات متوقفة لفترة طويلة
  const stopped = db.prepare(`SELECT ea.*, MAX(sl.created_at) AS since FROM equipment_assets ea LEFT JOIN equipment_status_log sl ON sl.equipment_id = ea.id AND sl.new_status = 'stopped' WHERE ea.status = 'stopped' AND ea.is_archived = 0 GROUP BY ea.id`).all();
  for (const eq of stopped) {
    if (!eq.since) continue;
    const days = daysBetween(eq.since, new Date().toISOString());
    if (days >= PROLONGED_STOP_DAYS) bump(upsertNotification(prolongedStopNotification(eq, days)));
  }

  return { created };
}
