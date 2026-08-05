// lib/hse/notificationsScan.js
// يفحص الجداول الحقيقية ويولّد تنبيهات فعلية (البند 18) - نفس نمط lib/equipment/notificationsScan.js:
// يُستدعى في بداية كل استجابة GET على /api/hse/notifications و/api/hse/dashboard (فحص عند
// الطلب request-time، بلا Cron/Background Job منفصل - قيد شفاف مطابق تماماً لما وثّقه القسم
// السابع عن نفسه: "لا مجدول Background Jobs حقيقي في بيئة Next.js API routes الخالصة هذه؛
// BREAKDOWN_STATUSES... الفحص يحدث عند كل طلب API بدل جدولة زمنية مستقلة").
import { hdb } from './schema.js';
import { upsertNotification } from './db/notifications.js';
import {
  permitExpiringNotification, criticalRiskNotification, overdueCorrectiveActionNotification,
  certificationExpiringNotification, ppeExpiringNotification, ppeLowStockNotification,
  overdueInspectionNotification, fireEquipmentExpiringNotification, openViolationNotification,
  risingIncidentRateNotification,
} from './notifications.js';

const PERMIT_WARNING_DAYS = 3;
const CERT_WARNING_DAYS = 14;
const PPE_WARNING_DAYS = 7;
const FIRE_EQ_WARNING_DAYS = 14;
const INSPECTION_OVERDUE_DAYS = 7;

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diffMs = new Date(dateStr).getTime() - Date.now();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function runHseNotificationScan(project_id) {
  const db = hdb();
  const projFilter = project_id ? ' AND project_id = @project_id' : '';
  const params = project_id ? { project_id } : {};

  // 1) تصاريح عمل تقترب من الانتهاء أو منتهية وما زالت نشطة
  const activePermits = db.prepare(
    `SELECT * FROM hse_permits WHERE status IN ('approved','active')${projFilter}`
  ).all(params);
  for (const permit of activePermits) {
    const daysLeft = daysUntil(permit.end_date);
    if (daysLeft !== null && daysLeft <= PERMIT_WARNING_DAYS) {
      upsertNotification(permitExpiringNotification(permit, daysLeft));
    }
  }

  // 2) مخاطر بمستوى حرج ما زالت مفتوحة
  const criticalRisks = db.prepare(
    `SELECT * FROM hse_risks WHERE risk_level = 'critical' AND status != 'closed'${projFilter}`
  ).all(params);
  for (const risk of criticalRisks) upsertNotification(criticalRiskNotification(risk));

  // 3) إجراءات تصحيحية متأخرة عن موعد استحقاقها
  const overdueActions = db.prepare(
    `SELECT * FROM hse_corrective_actions
     WHERE status NOT IN ('closed','verified') AND due_date IS NOT NULL AND due_date < date('now')${projFilter}`
  ).all(params);
  for (const action of overdueActions) upsertNotification(overdueCorrectiveActionNotification(action));

  // 4) شهادات تدريب تقترب من الانتهاء أو منتهية
  const certs = db.prepare(
    `SELECT c.*, co.course_name FROM hse_training_certifications c
     JOIN hse_training_courses co ON co.id = c.course_id
     WHERE c.status = 'valid' AND c.expiry_date IS NOT NULL`
  ).all();
  for (const cert of certs) {
    const daysLeft = daysUntil(cert.expiry_date);
    if (daysLeft !== null && daysLeft <= CERT_WARNING_DAYS) upsertNotification(certificationExpiringNotification(cert, daysLeft));
  }

  // 5) معدات وقاية شخصية تقترب من الانتهاء/الاستبدال
  const ppeDist = db.prepare(
    `SELECT d.*, i.item_name FROM hse_ppe_distributions d
     JOIN hse_ppe_items i ON i.id = d.ppe_item_id
     WHERE d.status = 'issued' AND d.expiry_date IS NOT NULL${projFilter}`
  ).all(params);
  for (const dist of ppeDist) {
    const daysLeft = daysUntil(dist.expiry_date);
    if (daysLeft !== null && daysLeft <= PPE_WARNING_DAYS) upsertNotification(ppeExpiringNotification(dist, daysLeft));
  }
  // مخزون معدات وقاية منخفض
  const lowStock = db.prepare(`SELECT * FROM hse_ppe_items WHERE is_archived = 0 AND quantity_on_hand <= min_stock AND min_stock > 0`).all();
  for (const item of lowStock) upsertNotification(ppeLowStockNotification(item));

  // 6) تفتيشات متأخرة (لا تزال "مسودة" بعد مرور مهلة معقولة على تاريخها)
  const overdueInspections = db.prepare(
    `SELECT * FROM hse_inspections WHERE status = 'draft' AND inspection_date < date('now', '-${INSPECTION_OVERDUE_DAYS} days')${projFilter}`
  ).all(params);
  for (const insp of overdueInspections) upsertNotification(overdueInspectionNotification(insp));

  // 7) معدات إطفاء تقترب من انتهاء الفحص/الصلاحية (إضافة من الوثيقة الأولى)
  const fireEq = db.prepare(
    `SELECT * FROM hse_fire_equipment WHERE status != 'out_of_service'
     AND (next_inspection_date IS NOT NULL OR expiry_date IS NOT NULL)${projFilter}`
  ).all(params);
  for (const eq of fireEq) {
    const dueDate = eq.expiry_date || eq.next_inspection_date;
    const daysLeft = daysUntil(dueDate);
    if (daysLeft !== null && daysLeft <= FIRE_EQ_WARNING_DAYS) upsertNotification(fireEquipmentExpiringNotification(eq, daysLeft));
  }

  // 8) مخالفات مفتوحة (إضافة من الوثيقة الأولى)
  const openViolations = db.prepare(`SELECT * FROM hse_violations WHERE status = 'open'${projFilter}`).all(params);
  for (const v of openViolations) upsertNotification(openViolationNotification(v));

  // 9) ارتفاع معدل الحوادث هذا الشهر مقابل الشهر الماضي (إضافة من الوثيقة الأولى، لكل مشروع نشط)
  const projects = project_id
    ? [{ id: project_id }]
    : db.prepare(`SELECT DISTINCT project_id AS id FROM hse_incidents`).all();
  for (const p of projects) {
    const thisMonth = db.prepare(
      `SELECT COUNT(*) AS c FROM hse_incidents WHERE project_id = ? AND strftime('%Y-%m', incident_date) = strftime('%Y-%m', 'now')`
    ).get(p.id).c;
    const lastMonth = db.prepare(
      `SELECT COUNT(*) AS c FROM hse_incidents WHERE project_id = ? AND strftime('%Y-%m', incident_date) = strftime('%Y-%m', date('now', '-1 month'))`
    ).get(p.id).c;
    if (thisMonth > lastMonth && lastMonth > 0) upsertNotification(risingIncidentRateNotification(p.id, thisMonth, lastMonth));
  }
}
