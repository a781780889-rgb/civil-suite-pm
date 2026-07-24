// lib/pm/notifications.js
// =============================================================================
// منطق توليد التنبيهات (البند: "الإشعارات" في مواصفة القسم) - دوال حسابية بحتة (بلا اتصال
// قاعدة بيانات) تُقرِّر *ما* يجب أن يظهر كتنبيه من بيانات حقيقية مُمرَّرة إليها؛ طبقة
// lib/pm/db/notifications.js هي من تجلب البيانات الفعلية وتُخزّن النتيجة.
//
// شفافية: لا يوجد في هذا التطبيق آلية دفع فعلية (بريد/SMS/WebSocket) لأن ذلك يتطلب بنية
// تحتية (خادم بريد/مزود SMS/عامل خلفي دائم) غير متوفرة في هذا الـ stack (Next.js API routes
// بلا Worker Process دائم). التنبيهات هنا **حقيقية ومُشتقّة فعلياً من البيانات الحية** في كل
// مرة تُطلب (أو عند وقوع الحدث مباشرة للتنبيهات الفورية)، وتُخزَّن مع حالة "مقروء/غير مقروء" -
// لكنها تُعرض عند فتح لوحة التنبيهات، لا تُدفَع تلقائياً للمستخدم خارج التطبيق.
// =============================================================================

const DAY_MS = 24 * 60 * 60 * 1000;

export function buildTaskDelayNotifications(delayedTasks) {
  return delayedTasks.map((t) => ({
    type: 'task_delay',
    severity: t.delayDays > 14 ? 'critical' : t.delayDays > 3 ? 'warning' : 'info',
    title: `تأخير في المهمة: ${t.title}`,
    message: `تجاوزت المهمة تاريخ نهايتها المخطط (${t.planned_end}) بمقدار ${t.delayDays} يوم.`,
    related_entity_type: 'task',
    related_entity_id: t.id,
    dedup_key: `task_delay:${t.id}:${t.planned_end}`,
  }));
}

export function buildBudgetNotification(project, budgetSummary, threshold = 90) {
  if (!budgetSummary || budgetSummary.currentBudget <= 0) return null;
  if (budgetSummary.spentPct < threshold) return null;
  const over = budgetSummary.isOverBudget;
  return {
    type: 'budget_overrun',
    severity: over ? 'critical' : 'warning',
    title: over ? 'تجاوز الميزانية المعتمدة' : 'اقتراب المصروفات من حد الميزانية',
    message: `نسبة الصرف الحالية ${budgetSummary.spentPct}% من الميزانية (${budgetSummary.currentBudget.toLocaleString('en-US')} ${project.currency || ''}).`,
    related_entity_type: 'project',
    related_entity_id: project.id,
    dedup_key: `budget_overrun:${project.id}:${Math.floor(budgetSummary.spentPct / 5)}`,
  };
}

export function buildContractExpiryNotification(project, todayStr, warnDays = 14) {
  if (!project.end_date || ['completed', 'cancelled', 'archived'].includes(project.status)) return null;
  const end = new Date(project.end_date);
  const today = new Date(todayStr);
  if (Number.isNaN(end.getTime())) return null;
  const daysLeft = Math.round((end.getTime() - today.getTime()) / DAY_MS);
  if (daysLeft > warnDays) return null;
  const passed = daysLeft < 0;
  return {
    type: 'contract_expiry',
    severity: passed ? 'critical' : 'warning',
    title: passed ? 'تجاوز المشروع تاريخ التسليم المخطط' : 'اقتراب موعد تسليم المشروع',
    message: passed
      ? `تجاوز المشروع تاريخ النهاية المخطط (${project.end_date}) بمقدار ${Math.abs(daysLeft)} يوم دون اكتمال.`
      : `تبقّى ${daysLeft} يوم على تاريخ نهاية المشروع المخطط (${project.end_date}).`,
    related_entity_type: 'project',
    related_entity_id: project.id,
    dedup_key: `contract_expiry:${project.id}:${project.end_date}:${passed ? 'passed' : 'upcoming'}`,
  };
}

/** تنبيه فوري (حدثي) - يُستدعى مباشرة من نقطة الإنشاء (مستند جديد، تغيير حالة، مخالفة سلامة، مشكلة جودة). */
export function buildEventNotification({ project_id, type, severity = 'info', title, message, related_entity_type, related_entity_id, uniqueSuffix }) {
  return {
    type,
    severity,
    title,
    message,
    related_entity_type: related_entity_type || null,
    related_entity_id: related_entity_id || null,
    dedup_key: `${type}:${project_id}:${related_entity_type || ''}:${related_entity_id || ''}:${uniqueSuffix ?? ''}`,
    project_id,
  };
}
