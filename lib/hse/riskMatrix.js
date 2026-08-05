// lib/hse/riskMatrix.js
// =============================================================================
// القسم الثامن: مصفوفة تقييم المخاطر (الوثيقة الثانية، البند 4: "تطبيق مصفوفة تقييم
// Likelihood × Severity لحساب مستوى الخطورة تلقائياً"). منطق رياضي بحت بلا أي استيراد
// لقاعدة البيانات أو Next/React - بنفس فلسفة lib/calc/*.js تماماً - قابل للاختبار الحقيقي
// المباشر عبر `node --test` دون أي اعتماديات (انظر tests/hse/riskMatrix.test.js).
//
// مقياس 1-5 لكل من الاحتمالية والشدة (معيار شائع ومعتمد في تطبيقات ISO 45001 العملية):
//   1 نادر جداً / إصابة طفيفة جداً  →  5 شبه مؤكد / كارثي (وفاة/إصابات متعددة)
// الدرجة = الاحتمالية × الشدة (1 إلى 25)، مقسّمة إلى 4 نطاقات حسب البند 4 حرفياً:
// منخفض/متوسط/مرتفع/حرج، مع لون مقترح لكل نطاق (البند 4: "إظهار الألوان المناسبة").
// =============================================================================

import { ValidationError } from '../calc/common.js';

export const LIKELIHOOD_SCALE = [
  { value: 1, label_ar: 'نادر جداً' },
  { value: 2, label_ar: 'غير محتمل' },
  { value: 3, label_ar: 'محتمل' },
  { value: 4, label_ar: 'محتمل جداً' },
  { value: 5, label_ar: 'شبه مؤكد' },
];

export const SEVERITY_SCALE = [
  { value: 1, label_ar: 'طفيفة (بلا إصابة/إسعاف أولي)' },
  { value: 2, label_ar: 'بسيطة (علاج طبي بسيط)' },
  { value: 3, label_ar: 'متوسطة (إصابة تستدعي إيقاف عمل)' },
  { value: 4, label_ar: 'جسيمة (إصابة خطيرة/عجز جزئي)' },
  { value: 5, label_ar: 'كارثية (وفاة/إصابات متعددة)' },
];

// النطاقات الأربعة (البند 4) - الحدود العليا شاملة (inclusive)، بنفس ترتيب RISK_LEVELS
// في lib/hse/schema.js حرفياً (مصدر واحد للتسميات نفسها).
export const RISK_LEVEL_BANDS = [
  { level: 'low', label_ar: 'منخفض', min: 1, max: 4, color: '#1F8A56' },
  { level: 'medium', label_ar: 'متوسط', min: 5, max: 9, color: '#B8860B' },
  { level: 'high', label_ar: 'مرتفع', min: 10, max: 15, color: '#D9581F' },
  { level: 'critical', label_ar: 'حرج', min: 16, max: 25, color: '#C0392B' },
];

function assertScaleValue(value, fieldLabel) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    throw new ValidationError(`${fieldLabel} يجب أن تكون رقماً صحيحاً بين 1 و5.`);
  }
  return n;
}

/** يحسب درجة الخطورة ومستواها من الاحتمالية والشدة (1-5 لكل منهما) - نواة مصفوفة البند 4. */
export function computeRiskLevel(likelihood, severity) {
  const l = assertScaleValue(likelihood, 'الاحتمالية (likelihood)');
  const s = assertScaleValue(severity, 'شدة التأثير (severity)');
  const score = l * s;
  const band = RISK_LEVEL_BANDS.find((b) => score >= b.min && score <= b.max);
  return { likelihood: l, severity: s, score, level: band.level, label_ar: band.label_ar, color: band.color };
}

/** يبني شبكة 5×5 كاملة لعرضها كمصفوفة تفاعلية في الواجهة (كل خلية مع لونها ومستواها). */
export function buildRiskMatrixGrid() {
  const grid = [];
  for (let s = 5; s >= 1; s -= 1) {
    const row = [];
    for (let l = 1; l <= 5; l += 1) {
      row.push(computeRiskLevel(l, s));
    }
    grid.push(row);
  }
  return grid;
}

/** يقارن تقييمَين (قبل/بعد إجراءات التحكم) ويصف اتجاه التغيّر - يُستخدم في شاشة إعادة التقييم. */
export function compareRiskAssessments(before, after) {
  const b = computeRiskLevel(before.likelihood, before.severity);
  const a = computeRiskLevel(after.likelihood, after.severity);
  const delta = a.score - b.score;
  let direction = 'unchanged';
  if (delta < 0) direction = 'improved';
  if (delta > 0) direction = 'worsened';
  return { before: b, after: a, delta, direction };
}

export function riskLevelLabel(level) {
  return RISK_LEVEL_BANDS.find((b) => b.level === level)?.label_ar || level;
}

export function riskLevelColor(level) {
  return RISK_LEVEL_BANDS.find((b) => b.level === level)?.color || '#666666';
}
