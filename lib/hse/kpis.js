// lib/hse/kpis.js
// =============================================================================
// القسم الثامن: صيغ مؤشرات الأداء (البند 16) - دوال رياضية بحتة بلا استعلامات قاعدة بيانات
// (التجميع الفعلي من الجداول يتم في lib/hse/db/dashboard.js الذي يستدعي هذه الدوال بأرقام
// حقيقية من hse_incidents/pm_attendance). قابلة للاختبار المباشر عبر node --test.
//
// معدل تكرار الحوادث (Incident/Injury Frequency Rate) ومعدل شدة الإصابات (Severity Rate)
// هنا يتبعان الصيغة القياسية المعتمدة دولياً (ISO/منظمات السلامة المهنية):
//   المعدل = (عدد الحوادث أو أيام الفقد × 1,000,000) ÷ إجمالي ساعات العمل الفعلية
// "1,000,000 ساعة عمل" هي وحدة القياس التقليدية (تقابل تقريباً نشاط مئات العمال بدوام كامل
// لسنة) - وليست 200,000 (المعيار الأمريكي OSHA البديل) لتوافقها مع NEBOSH/IOSH وISO 45001
// وهي الأكثر شيوعاً في مواصفات السلامة بالمنطقة. ساعات العمل مصدرها حقيقي بالكامل من
// SUM(pm_attendance.hours) للمشروع/الفترة المطلوبة - وليست تقديراً ثابتاً، تماماً كما يقتضي
// البند الإلزامي الخامس والعشرون ("لا تستخدم بيانات وهمية"). إن كانت ساعات العمل صفراً
// (لا حضور مسجَّل بعد) تُعاد null صراحة بدل رقم مضلِّل كالقسمة على صفر أو صفر زائف.
// =============================================================================

/** معدل تكرار الحوادث القابلة للتسجيل لكل مليون ساعة عمل. */
export function computeIncidentFrequencyRate({ recordableIncidents, totalManHours }) {
  if (!totalManHours || totalManHours <= 0) return null;
  return round2((recordableIncidents * 1_000_000) / totalManHours);
}

/** معدل شدة الإصابات (أيام العمل المفقودة) لكل مليون ساعة عمل. */
export function computeSeverityRate({ totalLostDays, totalManHours }) {
  if (!totalManHours || totalManHours <= 0) return null;
  return round2((totalLostDays * 1_000_000) / totalManHours);
}

/** نسبة إغلاق الملاحظات/الإجراءات التصحيحية (البند 16: "نسبة إغلاق الملاحظات"). */
export function computeClosureRate({ closedCount, totalCount }) {
  if (!totalCount || totalCount <= 0) return null;
  return round2((closedCount / totalCount) * 100);
}

/** نسبة الالتزام بالتدريب (البند 16: "نسبة الالتزام بالتدريب") - شهادات سارية ÷ إجمالي المطلوب. */
export function computeTrainingComplianceRate({ validCertifications, totalRequired }) {
  if (!totalRequired || totalRequired <= 0) return null;
  return round2((validCertifications / totalRequired) * 100);
}

/** نسبة الالتزام العام بالسلامة (لوحة التحكم الرئيسية، الوثيقة الأولى) - متوسط مرجّح بسيط
 * لثلاثة مكوّنات قابلة للقياس فعلياً: إغلاق الملاحظات + التفتيشات المكتملة في موعدها + التدريب. */
export function computeOverallComplianceScore({ closureRate, inspectionOnTimeRate, trainingComplianceRate }) {
  const parts = [closureRate, inspectionOnTimeRate, trainingComplianceRate].filter((v) => typeof v === 'number');
  if (parts.length === 0) return null;
  return round2(parts.reduce((a, b) => a + b, 0) / parts.length);
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
