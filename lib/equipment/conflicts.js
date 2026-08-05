// lib/equipment/conflicts.js
// منطق كشف التعارض الزمني - دوال نقية (pure) لا تلمس قاعدة البيانات، بنفس روح
// lib/pm/db/resources.js لكن مفصولة كملف مستقل لأنها تُستخدم من كل من الحجوزات والتخصيص
// (البند 6: "منع الحجز المتعارض"، البند 5: "منع تعيين نفس المعدة لمشروعين في نفس الفترة").

/** تتداخل فترتان زمنيتان؟ نهاية غير محددة = مستمرة (Infinity). */
export function rangesOverlap(startA, endA, startB, endB) {
  const sA = new Date(startA).getTime();
  const eA = endA ? new Date(endA).getTime() : Infinity;
  const sB = new Date(startB).getTime();
  const eB = endB ? new Date(endB).getTime() : Infinity;
  if (Number.isNaN(sA) || Number.isNaN(sB)) return false;
  return sA <= eB && sB <= eA;
}

/**
 * يفحص قائمة حجوزات/تخصيصات مرشحة (بنفس equipment_id، بحالة نشطة) ويعيد كل ما يتداخل زمنياً
 * مع الفترة المطلوبة. `excludeId` يستثني السجل الحالي نفسه عند التعديل.
 */
export function findOverlaps(candidates, startDate, endDate, excludeId = null) {
  return candidates.filter((c) => {
    if (excludeId != null && c.id === excludeId) return false;
    return rangesOverlap(startDate, endDate, c.start_date, c.end_date);
  });
}

/** يبني رسالة تعارض عربية واضحة تُعرض للمستخدم بدل رفض صامت (البند 6). */
export function formatConflictMessage(kind, overlaps) {
  const label = kind === 'reservation' ? 'حجز' : 'تخصيص';
  const list = overlaps
    .map((o) => `${label} من ${o.start_date} إلى ${o.end_date || 'غير محدد'} (${o.activity || o.project_name || '#' + o.id})`)
    .join('، ');
  return `يوجد تعارض مع ${overlaps.length === 1 ? label + ' سابق' : label + 'ات سابقة'}: ${list}`;
}
