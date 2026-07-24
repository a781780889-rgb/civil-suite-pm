// lib/boq/primitives.js
// =============================================================================
// دوال حساب هندسية بدائية (Primitives) - كل عناصر حصر الكميات (نحو 90 نوعاً موزّعة على
// 14 تخصصاً في القسم الثالث) تُبنى فوق هذه الدوال الستة فقط. هذا قرار متعمّد يتوافق مع
// مبدأ DRY المطلوب صراحة في متطلبات القسم: بدل تكرار معادلة شبه متطابقة عشرات المرات
// (حجم صندوقي لكل من: القواعد، الكمرات، طبقات الطرق...)، نكتبها مرة واحدة، نختبرها مرة
// واحدة، ثم يربط "سجل الأصناف" (categoryRegistry.js) كل نوع عنصر بالدالة المناسبة له.
// جميع المدخلات بوحدات SI: أمتار للأطوال والمساحات والأحجام، كيلوغرام للأوزان.
// =============================================================================

import { round, ValidationError } from '../calc/common.js';

function need(value, label) {
  if (value === undefined || value === null || value === '') {
    throw new ValidationError(`الحقل "${label}" مطلوب.`);
  }
  const n = Number(value);
  if (Number.isNaN(n)) throw new ValidationError(`الحقل "${label}" يجب أن يكون رقماً.`);
  if (n < 0) throw new ValidationError(`الحقل "${label}" لا يمكن أن يكون سالباً.`);
  return n;
}

function optional(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  return Number.isNaN(n) ? fallback : n;
}

/** حجم صندوقي: طول × عرض × ارتفاع/سماكة - القواعد، الكمرات، الأعمدة المستطيلة، طبقات الطرق... */
export function volumeBox({ lengthM, widthM, heightM }) {
  const l = need(lengthM, 'الطول'); const w = need(widthM, 'العرض'); const h = need(heightM, 'الارتفاع/السماكة');
  return round(l * w * h, 4);
}

/** حجم أسطواني: من القطر أو نصف القطر × الارتفاع - الخوازيق، الأعمدة الدائرية، الخزانات الدائرية */
export function volumeCylinder({ diameterM, radiusM, heightM }) {
  const h = need(heightM, 'الارتفاع');
  let r;
  if (radiusM !== undefined && radiusM !== null && radiusM !== '') r = need(radiusM, 'نصف القطر');
  else r = need(diameterM, 'القطر') / 2;
  return round(Math.PI * r ** 2 * h, 4);
}

/** حجم طبقة: مساحة مسقطة × سماكة - طبقات الطرق (ردم، أساس، أسفلت)، الأرضيات الخرسانية المطبوعة */
export function volumeLayer({ areaM2, thicknessM }) {
  const a = need(areaM2, 'المساحة'); const t = need(thicknessM, 'السماكة');
  return round(a * t, 4);
}

/**
 * مساحة (جدار/أرضية/سقف/عزل) بعد خصم الفتحات - إن أُعطيت المساحة مباشرة تُستخدم كما هي،
 * وإلا تُحسب من طول × عرض (أو طول × ارتفاع للجدران، بحسب تسمية الحقول في سجل الصنف)
 */
export function areaMinusOpenings({ areaM2, lengthM, widthM, openingsAreaM2 }) {
  let base;
  if (areaM2 !== undefined && areaM2 !== null && areaM2 !== '') {
    base = need(areaM2, 'المساحة');
  } else {
    base = need(lengthM, 'الطول') * need(widthM, 'العرض/الارتفاع');
  }
  const openings = optional(openingsAreaM2, 0);
  if (openings > base) {
    throw new ValidationError('مساحة الفتحات لا يمكن أن تتجاوز المساحة الإجمالية.');
  }
  return round(base - openings, 4);
}

/** طول إجمالي - كابلات، مواسير، بردورات، خطوط دهان أرضية */
export function lengthTotal({ lengthM, segments }) {
  const l = need(lengthM, 'الطول');
  const c = optional(segments, 1) || 1;
  return round(l * c, 3);
}

/** عدد إجمالي - أبواب، شبابيك، تجهيزات صحية وكهربائية */
export function countTotal({ count }) {
  const c = need(count, 'العدد');
  if (!Number.isFinite(c) || c <= 0) throw new ValidationError('العدد يجب أن يكون أكبر من صفر.');
  return round(c, 2);
}

/** إدخال يدوي مباشر - عند عدم انطباق أي دالة هندسية (أو لعناصر مخصصة يضيفها المستخدم) */
export function manualQuantity({ quantityManual }) {
  return round(need(quantityManual, 'الكمية'), 4);
}

export const PRIMITIVES = {
  box_volume: volumeBox,
  cylinder_volume: volumeCylinder,
  layer_volume: volumeLayer,
  area_minus_openings: areaMinusOpenings,
  length_total: lengthTotal,
  count_total: countTotal,
  manual_quantity: manualQuantity,
};

/** تطبيق مضاعِف "العدد" (عناصر متطابقة) ثم نسبة الهدر على كمية صافية، بنفس منطق باقي حاسبات النظام */
export function applyMultiplierAndWaste(netQuantity, { multiplier = 1, wastePct = 0 } = {}) {
  const mult = optional(multiplier, 1) || 1;
  const withMultiplier = netQuantity * mult;
  const withWaste = withMultiplier * (1 + optional(wastePct, 0) / 100);
  return { netQuantity: round(netQuantity, 4), withMultiplier: round(withMultiplier, 4), withWaste: round(withWaste, 4) };
}
