// lib/business/notifications.js
// =============================================================================
// منطق توليد التنبيهات (البند الحادي والعشرون) - دوال حسابية بحتة (بلا اتصال قاعدة بيانات)
// تُقرِّر *ما* يجب أن يظهر كتنبيه من بيانات حقيقية مُمرَّرة إليها؛ نفس فلسفة lib/pm/notifications.js
// بما فيها نفس الشفافية: لا آلية دفع فعلية (بريد/SMS) - التنبيهات تُشتق من البيانات الحية وتُخزَّن
// بحالة مقروء/غير مقروء، تُعرض عند فتح لوحة التنبيهات.
// =============================================================================
const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(fromStr, toStr) {
  const a = new Date(fromStr);
  const b = new Date(toStr);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((a.getTime() - b.getTime()) / DAY_MS);
}

/** اقتراب انتهاء عقد / تجاوزه بلا إغلاق. */
export function buildContractExpiryNotification(contract, todayStr, warnDays = 30) {
  if (!contract.end_date || ['completed', 'terminated', 'cancelled'].includes(contract.status)) return null;
  const daysLeft = daysBetween(contract.end_date, todayStr);
  if (daysLeft === null || daysLeft > warnDays) return null;
  const passed = daysLeft < 0;
  return {
    type: 'contract_expiry', severity: passed ? 'critical' : 'warning',
    title: passed ? `تجاوز العقد "${contract.title}" تاريخ الانتهاء` : `اقتراب انتهاء العقد "${contract.title}"`,
    message: passed
      ? `تجاوز العقد رقم ${contract.contract_no || contract.id} تاريخ النهاية (${contract.end_date}) بمقدار ${Math.abs(daysLeft)} يوم دون إغلاق.`
      : `تبقّى ${daysLeft} يوم على تاريخ نهاية العقد رقم ${contract.contract_no || contract.id} (${contract.end_date}).`,
    related_entity_type: 'contract', related_entity_id: contract.id,
    dedup_key: `contract_expiry:${contract.id}:${contract.end_date}:${passed ? 'passed' : 'upcoming'}`,
  };
}

/** انتهاء صلاحية عرض سعر لم يُحسم بعد. */
export function buildQuoteExpiryNotification(quote, todayStr, warnDays = 5) {
  if (!quote.validity_date || ['won', 'lost', 'expired'].includes(quote.status)) return null;
  const daysLeft = daysBetween(quote.validity_date, todayStr);
  if (daysLeft === null || daysLeft > warnDays) return null;
  const passed = daysLeft < 0;
  return {
    type: 'quote_expiry', severity: passed ? 'warning' : 'info',
    title: passed ? `انتهت صلاحية عرض السعر "${quote.title}"` : `اقتراب انتهاء صلاحية عرض السعر "${quote.title}"`,
    message: passed
      ? `تجاوز عرض السعر رقم ${quote.quote_no || quote.id} تاريخ الصلاحية (${quote.validity_date}) دون رد.`
      : `تبقّى ${daysLeft} يوم على انتهاء صلاحية عرض السعر رقم ${quote.quote_no || quote.id}.`,
    related_entity_type: 'quote', related_entity_id: quote.id,
    dedup_key: `quote_expiry:${quote.id}:${quote.validity_date}:${passed ? 'passed' : 'upcoming'}`,
  };
}

/** فرصة تحتاج متابعة (تجاوزت تاريخ الإغلاق المتوقع دون حسم). */
export function buildOpportunityFollowupNotification(opp, todayStr) {
  if (!opp.expected_close_date || ['won', 'lost'].includes(opp.stage)) return null;
  const daysLeft = daysBetween(opp.expected_close_date, todayStr);
  if (daysLeft === null || daysLeft >= 0) return null;
  return {
    type: 'opportunity_followup', severity: 'info',
    title: `فرصة "${opp.name}" تحتاج متابعة`,
    message: `تجاوزت الفرصة تاريخ الإغلاق المتوقع (${opp.expected_close_date}) بمقدار ${Math.abs(daysLeft)} يوم دون حسم.`,
    related_entity_type: 'opportunity', related_entity_id: opp.id,
    dedup_key: `opportunity_followup:${opp.id}:${opp.expected_close_date}`,
  };
}

/** تأخر مستخلص/دفعة عن موعد اعتماده أو صرفه. */
export function buildPaymentOverdueNotification(payment, contract, todayStr, warnDays = 15) {
  if (!payment.period_to || ['approved', 'paid', 'rejected'].includes(payment.status)) return null;
  const daysLate = daysBetween(todayStr, payment.period_to);
  if (daysLate === null || daysLate < warnDays) return null;
  return {
    type: 'payment_overdue', severity: 'warning',
    title: `مستخلص متأخر: ${payment.certificate_no || '#' + payment.id}`,
    message: `مستخلص العقد "${contract?.title || ''}" لا يزال بحالة "${payment.status}" بعد ${daysLate} يوم من نهاية فترته.`,
    related_entity_type: 'progress_payment', related_entity_id: payment.id,
    dedup_key: `payment_overdue:${payment.id}:${Math.floor(daysLate / 5)}`,
  };
}

/** التزام تجاوز تاريخ استحقاقه دون إنجاز. */
export function buildCommitmentOverdueNotification(commitment, todayStr) {
  if (!commitment.due_date || ['done', 'cancelled'].includes(commitment.status)) return null;
  const daysLate = daysBetween(todayStr, commitment.due_date);
  if (daysLate === null || daysLate < 0) return null;
  return {
    type: 'commitment_overdue', severity: daysLate > 7 ? 'critical' : 'warning',
    title: `التزام متأخر: ${commitment.title}`,
    message: `تجاوز الالتزام تاريخ الاستحقاق (${commitment.due_date}) بمقدار ${daysLate} يوم دون إنجاز.`,
    related_entity_type: 'commitment', related_entity_id: commitment.id,
    dedup_key: `commitment_overdue:${commitment.id}:${Math.floor(daysLate / 3)}`,
  };
}

/** أمر تغيير أو مستخلص بانتظار اعتماد - تنبيه لصاحب صلاحية الاعتماد. */
export function buildApprovalNeededNotification({ entityType, entityLabel, id, contractTitle }) {
  return {
    type: `${entityType}_approval_needed`, severity: 'info',
    title: `${entityLabel} بانتظار الاعتماد`,
    message: `${entityLabel} على العقد "${contractTitle || ''}" بانتظار مراجعة واعتماد.`,
    related_entity_type: entityType, related_entity_id: id,
    dedup_key: `${entityType}_approval_needed:${id}`,
  };
}

/** تنبيه فوري (حدثي) عام - لأي حدث لا يغطيه بانٍ مخصص أعلاه. */
export function buildEventNotification({ type, severity = 'info', title, message, related_entity_type, related_entity_id, uniqueSuffix, project_id }) {
  return {
    type, severity, title, message,
    related_entity_type: related_entity_type || null,
    related_entity_id: related_entity_id || null,
    dedup_key: `${type}:${related_entity_type || ''}:${related_entity_id || ''}:${uniqueSuffix ?? ''}`,
    project_id: project_id || null,
  };
}
