// lib/pm/progress.js
// =============================================================================
// حساب نسب الإنجاز تصاعدياً (Roll-up) من المهام إلى المرحلة إلى المشروع - وزن كل مهمة في
// المتوسط هو مدتها بالأيام (نفس منطق Earned Value: SUM(duration_i * progress_i) / SUM(duration_i))
// بدل متوسط بسيط، حتى لا تُخفي مهمة صغيرة (يوم واحد) مكتملة تأخر مهمة كبيرة (30 يوماً).
// يلبي "تحديث نسبة إنجاز المشروع تلقائياً بناءً على المهام" (قاعدة رابعاً) دون معامل تقريبي.
// =============================================================================

function clampPct(v) {
  return Math.max(0, Math.min(100, Number(v) || 0));
}

export function computeWeightedProgress(items) {
  if (!items || items.length === 0) return 0;
  const totalWeight = items.reduce((sum, i) => sum + Math.max(0.01, Number(i.duration_days) || 0), 0);
  if (totalWeight <= 0) return 0;
  const weighted = items.reduce(
    (sum, i) => sum + Math.max(0.01, Number(i.duration_days) || 0) * clampPct(i.progress_pct),
    0
  );
  return Math.round((weighted / totalWeight) * 100) / 100;
}

/** نسبة إنجاز المشروع من مهامه الرئيسية (المهام الفرعية محسوبة أصلاً داخل نسبة أبيها). */
export function computeProjectProgress(allTasks) {
  const topLevel = allTasks.filter((t) => !t.parent_task_id);
  return computeWeightedProgress(topLevel.length ? topLevel : allTasks);
}

/** نسبة إنجاز مرحلة من مهامها فقط؛ يُعيد null إن لم تحتوِ المرحلة أي مهمة بعد (فيُستخدم عندها القيمة المُدخلة يدوياً). */
export function computePhaseProgress(tasksInPhase) {
  const topLevel = tasksInPhase.filter((t) => !t.parent_task_id);
  const relevant = topLevel.length ? topLevel : tasksInPhase;
  if (!relevant.length) return null;
  return computeWeightedProgress(relevant);
}

/** نسبة إنجاز مهمة أب من مهامها الفرعية المباشرة؛ null إن لم توجد مهام فرعية (تبقى القيمة المُدخلة يدوياً). */
export function computeTaskProgressFromSubtasks(subtasks) {
  if (!subtasks || subtasks.length === 0) return null;
  return computeWeightedProgress(subtasks);
}
