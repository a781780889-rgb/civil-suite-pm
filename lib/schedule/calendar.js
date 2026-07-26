// lib/schedule/calendar.js
// =============================================================================
// طبقة التقويم الواعي بأيام العمل الفعلية (Working-Day Calendar) - القاعدة السادسة
// والحادية عشرة الإلزاميتان: الحسابات الزمنية يجب أن تعتمد على أيام عمل فعلية (لا أيام
// تقويمية خام)، مع دعم عطل رسمية/إجازات لكل تقويم.
//
// التصميم: تبقى رياضيات محرك المسار الحرج (lib/schedule/criticalPath.js) في "مساحة إزاحة"
// مجرّدة (offset) بنفس بنية المحرك المُختبر في القسم الرابع (lib/pm/criticalPath.js) - فقط
// معنى وحدة الإزاحة هنا "يوم عمل" بدل "يوم تقويمي"، ويتم التحويل النهائي فقط إلى تواريخ
// حقيقية عبر فهرس مُحسَّب مسبقاً (buildCalendarIndex) بدل المشي اليومي المتكرر لكل نشاط -
// ضرورياً للأداء مع آلاف الأنشطة (البند الرابع عشر الإلزامي).
// =============================================================================

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

function parseUTC(dateStr) {
  return new Date(dateStr + 'T00:00:00Z');
}

/** يحوّل صف تقويم من قاعدة البيانات (working_days كنص JSON) + استثناءاته إلى كائن جاهز للاستخدام. */
export function normalizeCalendar(calendarRow, exceptions = []) {
  let workingDays;
  try {
    workingDays = calendarRow?.working_days ? JSON.parse(calendarRow.working_days) : [0, 1, 2, 3, 4];
  } catch {
    workingDays = [0, 1, 2, 3, 4];
  }
  const workingSet = new Set(workingDays);
  const exceptionMap = new Map();
  for (const ex of exceptions) exceptionMap.set(ex.exception_date, !!ex.is_working);
  return {
    id: calendarRow?.id ?? null,
    name: calendarRow?.name || 'التقويم الافتراضي',
    workingSet,
    exceptionMap,
    hoursPerDay: calendarRow?.hours_per_day || 8,
  };
}

/** تقويم افتراضي (أحد-خميس، 8 ساعات) يُستخدم إن لم يُربط نشاط/جدول بتقويم محدَّد. */
export const DEFAULT_CALENDAR = normalizeCalendar(null, []);

/** هل هذا التاريخ يوم عمل وفق هذا التقويم؟ الاستثناءات المُدخلة (عطلة/يوم عمل استثنائي) تتفوّق على قاعدة أيام الأسبوع. */
export function isWorkingDay(calendar, dateStr) {
  if (calendar.exceptionMap.has(dateStr)) return calendar.exceptionMap.get(dateStr);
  const weekday = parseUTC(dateStr).getUTCDay();
  return calendar.workingSet.has(weekday);
}

/** يُقرّب تاريخاً إلى أقرب يوم عمل بنفس الاتجاه أو بعده (direction=1) أو قبله (direction=-1). */
export function snapToWorkingDay(calendar, dateStr, direction = 1) {
  let cursor = parseUTC(dateStr);
  let guard = 0;
  while (!isWorkingDay(calendar, toDateStr(cursor)) && guard < 3660) {
    cursor.setUTCDate(cursor.getUTCDate() + direction);
    guard += 1;
  }
  return toDateStr(cursor);
}

/** تحويل مباشر (مشي يومي) لإزاحة أيام عمل إلى تاريخ - يُستخدم فقط كحالة احتياطية خارج نطاق الفهرس المُحسَّب. */
function workingOffsetToDateDirect(calendar, anchorDateStr, offset) {
  const anchor = snapToWorkingDay(calendar, anchorDateStr, 1);
  if (offset === 0) return anchor;
  let cursor = parseUTC(anchor);
  const step = offset > 0 ? 1 : -1;
  let remaining = Math.round(Math.abs(offset));
  let guard = 0;
  while (remaining > 0 && guard < 20000) {
    cursor.setUTCDate(cursor.getUTCDate() + step);
    if (isWorkingDay(calendar, toDateStr(cursor))) remaining -= 1;
    guard += 1;
  }
  return toDateStr(cursor);
}

/**
 * يبني فهرساً مسبقاً ثنائي الاتجاه (تاريخ<->إزاحة أيام عمل) حول تاريخ إرساء، لتفادي
 * المشي اليومي المتكرر عند تحويل مئات/آلاف الأنشطة - أساسي لأداء المشاريع الكبيرة.
 * النطاق الافتراضي: نحو 10 سنوات للأمام وسنة للخلف، كافٍ عملياً لأي مشروع هندسي واقعي؛
 * أي تاريخ خارج النطاق يُحسب مباشرة كحالة احتياطية نادرة (workingOffsetToDateDirect).
 */
export function buildCalendarIndex(calendar, anchorDateStr, { pastDays = 370, futureDays = 3650 } = {}) {
  const anchor = snapToWorkingDay(calendar, anchorDateStr || new Date().toISOString().slice(0, 10), 1);
  const dateToOffset = new Map();
  const offsetToDate = new Map();
  dateToOffset.set(anchor, 0);
  offsetToDate.set(0, anchor);

  let cursor = parseUTC(anchor);
  let offset = 0;
  let guard = 0;
  while (offset < futureDays && guard < futureDays * 3 + 60) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard += 1;
    const ds = toDateStr(cursor);
    if (isWorkingDay(calendar, ds)) {
      offset += 1;
      dateToOffset.set(ds, offset);
      offsetToDate.set(offset, ds);
    }
  }

  cursor = parseUTC(anchor);
  offset = 0;
  guard = 0;
  while (offset > -pastDays && guard < pastDays * 3 + 60) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    guard += 1;
    const ds = toDateStr(cursor);
    if (isWorkingDay(calendar, ds)) {
      offset -= 1;
      dateToOffset.set(ds, offset);
      offsetToDate.set(offset, ds);
    }
  }

  return {
    anchorDateStr: anchor,
    calendar,
    /** يحوّل تاريخاً إلى إزاحة أيام عمل بالنسبة لتاريخ الإرساء (0 = تاريخ الإرساء نفسه). */
    offsetOf(dateStr) {
      if (!dateStr) return 0;
      if (dateToOffset.has(dateStr)) return dateToOffset.get(dateStr);
      const snapped = snapToWorkingDay(calendar, dateStr, 1);
      if (dateToOffset.has(snapped)) return dateToOffset.get(snapped);
      // خارج نطاق الفهرس: عدّ تقريبي مباشر (نادر جداً في الاستخدام الفعلي)
      return dateStr > anchor
        ? Math.round((parseUTC(dateStr) - parseUTC(anchor)) / 86400000 * (5 / 7))
        : -Math.round((parseUTC(anchor) - parseUTC(dateStr)) / 86400000 * (5 / 7));
    },
    /** يحوّل إزاحة أيام عمل إلى تاريخ حقيقي. */
    dateOf(offset) {
      const rounded = Math.round(offset);
      if (offsetToDate.has(rounded)) return offsetToDate.get(rounded);
      return workingOffsetToDateDirect(calendar, anchor, rounded);
    },
  };
}

/** عدد أيام العمل بين تاريخين (شامل الطرفين) وفق التقويم - يُستخدم لحساب "أيام التأخير الفعلية". */
export function countWorkingDaysBetween(calendar, fromDateStr, toDateStrArg) {
  if (!fromDateStr || !toDateStrArg) return 0;
  const from = parseUTC(fromDateStr);
  const to = parseUTC(toDateStrArg);
  if (to < from) return -countWorkingDaysBetween(calendar, toDateStrArg, fromDateStr);
  let cursor = new Date(from);
  let count = 0;
  let guard = 0;
  while (cursor <= to && guard < 20000) {
    if (isWorkingDay(calendar, toDateStr(cursor))) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard += 1;
  }
  return count;
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
