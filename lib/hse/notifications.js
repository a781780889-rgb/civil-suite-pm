// lib/hse/notifications.js
// دوال بناء تنبيهات نقية (بلا وصول لقاعدة البيانات مباشرة) - نفس نمط lib/equipment/notifications.js
// تماماً. تُستدعى من lib/hse/notificationsScan.js بأرقام حقيقية من الجداول، والنتيجة تُمرَّر
// لـ upsertNotification في db/notifications.js. تغطي كل المحفزات السبعة في البند 18 حرفياً،
// بالإضافة لثلاثة محفزات من الوثيقة الأولى (انتهاء معدات إطفاء / ارتفاع معدل الحوادث / مخالفة مفتوحة).

export function permitExpiringNotification(permit, daysLeft) {
  const urgent = daysLeft <= 0;
  return {
    project_id: permit.project_id,
    type: urgent ? 'permit_expired' : 'permit_expiring',
    severity: urgent ? 'critical' : 'warning',
    title: urgent ? `تصريح عمل منتهي: ${permit.permit_no}` : `تصريح عمل يقترب من الانتهاء: ${permit.permit_no}`,
    message: urgent
      ? `انتهى تصريح "${permit.permit_no}" (${permit.permit_type}) بتاريخ ${permit.end_date} ولم يُغلق بعد.`
      : `تصريح "${permit.permit_no}" ينتهي خلال ${daysLeft} يوم (${permit.end_date}).`,
    related_entity_type: 'permit', related_entity_id: permit.id,
    dedup_key: `permit_${urgent ? 'expired' : 'expiring'}:${permit.id}`,
  };
}

export function criticalRiskNotification(risk) {
  return {
    project_id: risk.project_id,
    type: 'critical_risk',
    severity: 'critical',
    title: `خطر بمستوى حرج: ${risk.title}`,
    message: `الخطر "${risk.title}" (${risk.risk_no}) بدرجة ${risk.risk_score}/25 لا يزال مفتوحاً بلا إجراءات تحكم كافية.`,
    related_entity_type: 'risk', related_entity_id: risk.id,
    dedup_key: `critical_risk_open:${risk.id}`,
  };
}

export function overdueCorrectiveActionNotification(action) {
  return {
    project_id: action.project_id,
    type: 'corrective_action_overdue',
    severity: 'warning',
    title: `إجراء تصحيحي متأخر: ${action.action_no}`,
    message: `الإجراء "${action.description}" كان مستحقاً بتاريخ ${action.due_date} ولا يزال بحالة "${action.status}".`,
    related_entity_type: 'corrective_action', related_entity_id: action.id,
    dedup_key: `ca_overdue:${action.id}`,
  };
}

export function certificationExpiringNotification(cert, daysLeft) {
  return {
    project_id: null,
    type: 'certification_expiring',
    severity: daysLeft <= 0 ? 'critical' : 'warning',
    title: daysLeft <= 0 ? `شهادة تدريب منتهية: ${cert.trainee_name}` : `شهادة تدريب تقترب من الانتهاء: ${cert.trainee_name}`,
    message: daysLeft <= 0
      ? `شهادة "${cert.trainee_name}" (${cert.course_name}) منتهية منذ ${Math.abs(daysLeft)} يوم.`
      : `شهادة "${cert.trainee_name}" (${cert.course_name}) تنتهي خلال ${daysLeft} يوم.`,
    related_entity_type: 'training_certification', related_entity_id: cert.id,
    dedup_key: `cert_expiring:${cert.id}`,
  };
}

export function ppeExpiringNotification(dist, daysLeft) {
  return {
    project_id: dist.project_id,
    type: 'ppe_expiring',
    severity: daysLeft <= 0 ? 'warning' : 'info',
    title: daysLeft <= 0 ? `معدة وقاية منتهية الصلاحية: ${dist.employee_name}` : `معدة وقاية تقترب من الاستبدال: ${dist.employee_name}`,
    message: `معدة "${dist.item_name}" الخاصة بـ${dist.employee_name} ${daysLeft <= 0 ? 'انتهت صلاحيتها' : `تحتاج استبدالاً خلال ${daysLeft} يوم`}.`,
    related_entity_type: 'ppe_distribution', related_entity_id: dist.id,
    dedup_key: `ppe_expiring:${dist.id}`,
  };
}

export function ppeLowStockNotification(item) {
  return {
    project_id: null,
    type: 'ppe_low_stock',
    severity: 'warning',
    title: `مخزون منخفض: ${item.item_name}`,
    message: `الكمية المتوفرة من "${item.item_name}" هي ${item.quantity_on_hand} (الحد الأدنى ${item.min_stock}).`,
    related_entity_type: 'ppe_item', related_entity_id: item.id,
    dedup_key: `ppe_low_stock:${item.id}:${item.quantity_on_hand}`,
  };
}

export function newIncidentNotification(incident) {
  return {
    project_id: incident.project_id,
    type: 'new_incident',
    severity: incident.incident_type === 'fatality' || incident.incident_type === 'lost_time_injury' ? 'critical' : 'warning',
    title: `حادث جديد: ${incident.incident_no}`,
    message: `تم تسجيل حادث من نوع "${incident.incident_type}" بتاريخ ${incident.incident_date}.`,
    related_entity_type: 'incident', related_entity_id: incident.id,
    dedup_key: `new_incident:${incident.id}`,
  };
}

export function overdueInspectionNotification(inspection) {
  return {
    project_id: inspection.project_id,
    type: 'inspection_overdue',
    severity: 'warning',
    title: `تفتيش متأخر: ${inspection.inspection_no}`,
    message: `التفتيش "${inspection.inspection_no}" بتاريخ ${inspection.inspection_date} لا يزال بحالة مسودة بلا إغلاق.`,
    related_entity_type: 'inspection', related_entity_id: inspection.id,
    dedup_key: `inspection_overdue:${inspection.id}`,
  };
}

export function fireEquipmentExpiringNotification(eq, daysLeft) {
  return {
    project_id: eq.project_id,
    type: 'fire_equipment_expiring',
    severity: daysLeft <= 0 ? 'critical' : 'warning',
    title: daysLeft <= 0 ? `معدة إطفاء منتهية: ${eq.type_detail || eq.equipment_type}` : `فحص معدة إطفاء مستحق قريباً`,
    message: `معدة الإطفاء (${eq.equipment_type}) في "${eq.location || 'الموقع'}" ${daysLeft <= 0 ? 'انتهت صلاحيتها/فحصها' : `يستحق فحصها خلال ${daysLeft} يوم`}.`,
    related_entity_type: 'fire_equipment', related_entity_id: eq.id,
    dedup_key: `fire_eq_expiring:${eq.id}`,
  };
}

export function openViolationNotification(violation) {
  return {
    project_id: violation.project_id,
    type: 'violation_open',
    severity: violation.severity === 'critical' || violation.severity === 'high' ? 'critical' : 'warning',
    title: `مخالفة مفتوحة: ${violation.violation_no}`,
    message: `المخالفة "${violation.violation_type}" بتاريخ ${violation.violation_date} لا تزال مفتوحة.`,
    related_entity_type: 'violation', related_entity_id: violation.id,
    dedup_key: `violation_open:${violation.id}`,
  };
}

export function risingIncidentRateNotification(project_id, thisMonthCount, lastMonthCount) {
  return {
    project_id,
    type: 'incident_rate_rising',
    severity: 'warning',
    title: 'ارتفاع في معدل الحوادث',
    message: `عدد الحوادث هذا الشهر (${thisMonthCount}) أعلى من الشهر الماضي (${lastMonthCount}).`,
    related_entity_type: 'project', related_entity_id: project_id,
    dedup_key: `incident_rate_rising:${project_id}:${new Date().toISOString().slice(0, 7)}`,
  };
}
