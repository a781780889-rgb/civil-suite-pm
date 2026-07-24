// lib/pm/resourceConflicts.js
// =============================================================================
// اكتشاف تعارض الموارد بين المشاريع (قاعدة سابعاً الإلزامية: "اكتشاف تعارض الموارد بين
// المشاريع"). فحص تداخل فترات زمنية فعلي بالمقارنة الرياضية القياسية:
//   تتداخل الفترتان  ⇔  start1 <= end2  AND  start2 <= end1
// وليس تخميناً أو مقارنة نصية للتواريخ.
// =============================================================================

function rangesOverlap(startA, endA, startB, endB) {
  if (!startA || !endA || !startB || !endB) return false;
  return startA <= endB && startB <= endA;
}

/** يفحص جميع تعيينات مورد واحد (نشطة) ويُعيد كل زوج متداخل زمنياً، حتى لو كان في نفس المشروع مرتين. */
export function findConflictsForResource(assignments) {
  const active = assignments.filter((a) => a.status !== 'cancelled' && a.start_date && a.end_date);
  const conflicts = [];
  for (let i = 0; i < active.length; i += 1) {
    for (let j = i + 1; j < active.length; j += 1) {
      const a = active[i];
      const b = active[j];
      if (rangesOverlap(a.start_date, a.end_date, b.start_date, b.end_date)) {
        conflicts.push({ assignmentA: a, assignmentB: b, sameProject: a.project_id === b.project_id });
      }
    }
  }
  return conflicts;
}

/** فحص شامل لكل الموارد دفعة واحدة (تُجمَّع التعيينات مسبقاً حسب resource_id من طبقة DB). */
export function findAllConflicts(assignmentsByResource) {
  const result = [];
  for (const [resourceId, assignments] of assignmentsByResource.entries()) {
    const conflicts = findConflictsForResource(assignments);
    if (conflicts.length) result.push({ resourceId, conflicts });
  }
  return result;
}
