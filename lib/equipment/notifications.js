// lib/equipment/notifications.js
// دوال بناء التنبيهات (pure builders) - كل دالة تُعيد كائناً جاهزاً للحفظ عبر
// lib/equipment/db/notifications.js:upsertNotification، بمفتاح dedup_key ثابت يمنع التكرار
// عند إعادة المسح (نفس أسلوب lib/pm/notifications.js). البند 23: التنبيهات.

export function maintenanceDueNotification(equipment, schedule) {
  return {
    equipment_id: equipment.id,
    project_id: equipment.current_project_id || null,
    type: 'maintenance_due',
    severity: 'warning',
    title: `صيانة مستحقة قريباً: ${equipment.name}`,
    message: `الجدول "${schedule.title}" مستحق ${schedule.next_due_date ? 'بتاريخ ' + schedule.next_due_date : ''}${schedule.next_due_hour_meter ? ' أو عند ساعة تشغيل ' + schedule.next_due_hour_meter : ''}.`,
    related_entity_type: 'maintenance_schedule',
    related_entity_id: schedule.id,
    dedup_key: `equip-maint-due-${equipment.id}-${schedule.id}-${schedule.next_due_date || schedule.next_due_hour_meter}`,
  };
}

export function warrantyExpiryNotification(equipment) {
  return {
    equipment_id: equipment.id,
    project_id: equipment.current_project_id || null,
    type: 'warranty_expiry',
    severity: 'info',
    title: `اقتراب انتهاء الضمان: ${equipment.name}`,
    message: `ينتهي ضمان المعدة بتاريخ ${equipment.warranty_expiry}.`,
    related_entity_type: 'equipment',
    related_entity_id: equipment.id,
    dedup_key: `equip-warranty-${equipment.id}-${equipment.warranty_expiry}`,
  };
}

export function insuranceExpiryNotification(equipment) {
  return {
    equipment_id: equipment.id,
    project_id: equipment.current_project_id || null,
    type: 'insurance_expiry',
    severity: 'warning',
    title: `اقتراب انتهاء التأمين: ${equipment.name}`,
    message: `ينتهي تأمين المعدة (${equipment.insurance_provider || ''}) بتاريخ ${equipment.insurance_expiry}.`,
    related_entity_type: 'equipment',
    related_entity_id: equipment.id,
    dedup_key: `equip-insurance-${equipment.id}-${equipment.insurance_expiry}`,
  };
}

export function highFuelConsumptionNotification(equipment, fuelLog, deviationPct) {
  return {
    equipment_id: equipment.id,
    project_id: fuelLog.project_id || equipment.current_project_id || null,
    type: 'fuel_anomaly',
    severity: 'warning',
    title: `استهلاك وقود غير طبيعي: ${equipment.name}`,
    message: `التعبئة بتاريخ ${fuelLog.fill_date} أظهرت استهلاكاً أعلى من المعدل المرجعي بنسبة ${deviationPct}%.`,
    related_entity_type: 'fuel_log',
    related_entity_id: fuelLog.id,
    dedup_key: `equip-fuel-anomaly-${fuelLog.id}`,
  };
}

export function newBreakdownNotification(equipment, breakdown) {
  return {
    equipment_id: equipment.id,
    project_id: breakdown.project_id || equipment.current_project_id || null,
    type: 'breakdown',
    severity: breakdown.severity === 'critical' || breakdown.severity === 'high' ? 'critical' : 'warning',
    title: `عطل جديد (${breakdown.report_no}): ${equipment.name}`,
    message: breakdown.description,
    related_entity_type: 'breakdown',
    related_entity_id: breakdown.id,
    dedup_key: `equip-breakdown-new-${breakdown.id}`,
  };
}

export function overdueRepairNotification(equipment, breakdown, daysOpen) {
  return {
    equipment_id: equipment.id,
    project_id: breakdown.project_id || equipment.current_project_id || null,
    type: 'overdue_repair',
    severity: 'critical',
    title: `تأخر إصلاح عطل: ${equipment.name}`,
    message: `العطل ${breakdown.report_no} ما زال مفتوحاً منذ ${daysOpen} يوماً.`,
    related_entity_type: 'breakdown',
    related_entity_id: breakdown.id,
    dedup_key: `equip-breakdown-overdue-${breakdown.id}-${daysOpen}`,
  };
}

export function hoursExceededNotification(equipment, schedule) {
  return {
    equipment_id: equipment.id,
    project_id: equipment.current_project_id || null,
    type: 'hours_exceeded',
    severity: 'critical',
    title: `تجاوز ساعات التشغيل المحددة: ${equipment.name}`,
    message: `عداد الساعات الحالي (${equipment.current_hour_meter}) تجاوز الحد المحدد للصيانة (${schedule.next_due_hour_meter}) في جدول "${schedule.title}".`,
    related_entity_type: 'maintenance_schedule',
    related_entity_id: schedule.id,
    dedup_key: `equip-hours-exceeded-${equipment.id}-${schedule.id}-${equipment.current_hour_meter}`,
  };
}

export function operatorLicenseExpiryNotification(operator) {
  return {
    equipment_id: null,
    project_id: null,
    type: 'operator_license_expiry',
    severity: 'warning',
    title: `اقتراب انتهاء رخصة مشغل: ${operator.name}`,
    message: `تنتهي رخصة (${operator.license_type || ''}) بتاريخ ${operator.license_expiry}.`,
    related_entity_type: 'operator',
    related_entity_id: operator.id,
    dedup_key: `equip-operator-license-${operator.id}-${operator.license_expiry}`,
  };
}

export function rentalExpiryNotification(equipment, rental) {
  return {
    equipment_id: equipment.id,
    project_id: equipment.current_project_id || null,
    type: 'rental_expiry',
    severity: 'warning',
    title: `اقتراب انتهاء عقد إيجار: ${equipment.name}`,
    message: `ينتهي عقد الإيجار رقم ${rental.contract_no || rental.id} مع ${rental.rental_company} بتاريخ ${rental.rental_end}.`,
    related_entity_type: 'rental',
    related_entity_id: rental.id,
    dedup_key: `equip-rental-expiry-${rental.id}-${rental.rental_end}`,
  };
}

export function lowStockNotification(part) {
  return {
    equipment_id: null,
    project_id: null,
    type: 'low_stock',
    severity: 'warning',
    title: `انخفاض مخزون قطعة غيار: ${part.part_name}`,
    message: `الكمية المتوفرة (${part.quantity_on_hand}) أقل من الحد الأدنى (${part.min_stock}).`,
    related_entity_type: 'spare_part',
    related_entity_id: part.id,
    dedup_key: `equip-low-stock-${part.id}-${part.quantity_on_hand}`,
  };
}

export function prolongedStopNotification(equipment, daysStopped) {
  return {
    equipment_id: equipment.id,
    project_id: equipment.current_project_id || null,
    type: 'prolonged_stop',
    severity: 'info',
    title: `توقف طويل: ${equipment.name}`,
    message: `المعدة متوقفة منذ ${daysStopped} يوماً دون تشغيل.`,
    related_entity_type: 'equipment',
    related_entity_id: equipment.id,
    dedup_key: `equip-prolonged-stop-${equipment.id}-${daysStopped}`,
  };
}
