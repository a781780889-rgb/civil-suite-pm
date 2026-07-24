// lib/calc/rebar/core.js
// =============================================================================
// المحرك الأساسي لحاسبة حديد التسليح (القسم الثاني)
// كل الأطوال (خطافات، تثبيت، تراكب) مُشتقة هندسياً من قطر السيخ ومقاومة الخرسانة وإجهاد
// الحديد الفعليين - وفق المعادلة العامة الكاملة لـ ACI 318-19 §25.4 (وليست معاملاً ثابتاً
// كـ ×1.15 كما هو محظور صراحة في متطلبات القسم).
// =============================================================================

import { round } from '../common.js';

export const STEEL_DENSITY_KG_M3 = 7850;
export const REBAR_DIAMETERS_MM = [6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32, 36, 40];
export const COMMERCIAL_BAR_LENGTH_M = 12; // الطول التجاري القياسي لسيخ الحديد في السوق السعودي/الخليجي

/** مساحة مقطع السيخ mm² */
export function barAreaMm2(dbMm) {
  return (Math.PI / 4) * dbMm ** 2;
}

/** وزن المتر الطولي kg/m - من الكثافة الفعلية للفولاذ، وليس من جدول جاهز */
export function barUnitWeightKgM(dbMm) {
  return (barAreaMm2(dbMm) * STEEL_DENSITY_KG_M3) / 1e6;
}

// -----------------------------------------------------------------------------
// معاملات التعديل (ACI 318-19 §25.4.2.5)
// -----------------------------------------------------------------------------

/** ψt: موقع الصب - 1.3 للحديد العلوي (أكثر من 300مم خرسانة طازجة أسفله)، وإلا 1.0 */
export function psi_t(isTopBar) {
  return isTopBar ? 1.3 : 1.0;
}

/** ψe: الطلاء - إيبوكسي بغطاء/تباعد قليل=1.5، إيبوكسي عادي=1.2، بدون طلاء=1.0 */
export function psi_e(coating) {
  if (coating === 'epoxy_tight') return 1.5;
  if (coating === 'epoxy') return 1.2;
  return 1.0;
}

/** ψs: حجم السيخ - 0.8 لأقطار ≤19مم (تقريباً #6 وأصغر)، 1.0 لما هو أكبر */
export function psi_s(dbMm) {
  return dbMm <= 19 ? 0.8 : 1.0;
}

/** ψg: رتبة الحديد (إضافة ACI 318-19) */
export function psi_g(fyMPa) {
  if (fyMPa <= 420) return 1.0;
  if (fyMPa <= 550) return 1.15;
  return 1.3;
}

// -----------------------------------------------------------------------------
// طول التثبيت (Development Length) - المعادلة العامة الكاملة §25.4.2.4، Ktr=0 (تبسيط
// محافظ ومسموح به صراحةً في الكود عند عدم توفر تفاصيل الحديد العرضي بدقة)
// -----------------------------------------------------------------------------

/**
 * طول التثبيت للشد لسيخ مشوّر مستقيم
 * cbMm: أصغر من (المسافة من مركز السيخ لأقرب سطح خرساني) أو (نصف التباعد محور لمحور)
 */
export function developmentLengthTensionMm({
  dbMm,
  fcMPa,
  fyMPa,
  cbMm,
  isTopBar = false,
  coating = 'none',
  lambda = 1.0,
}) {
  const psiTE = Math.min(psi_t(isTopBar) * psi_e(coating), 1.7); // الحد الأقصى للجداء وفق الكود
  const psiS = psi_s(dbMm);
  const psiG = psi_g(fyMPa);
  const cbOverDb = Math.min(cbMm / dbMm, 2.5); // Ktr=0 لذا الحد هو cb/db مباشرة، بحد أقصى 2.5
  const ld = (fyMPa * psiTE * psiS * psiG) / (1.1 * lambda * Math.sqrt(fcMPa) * cbOverDb) * dbMm;
  return Math.max(ld, 300); // الحد الأدنى المطلق 300مم
}

/** طول التثبيت للضغط (الأوتاد/الحديد النازل عند القواعد) - ACI 318 §25.4.9 */
export function developmentLengthCompressionMm({ dbMm, fcMPa, fyMPa, lambda = 1.0, confined = false }) {
  const psiR = confined ? 0.75 : 1.0;
  const l1 = (0.24 * fyMPa * psiR * dbMm) / (lambda * Math.sqrt(fcMPa));
  const l2 = 0.043 * fyMPa * dbMm;
  return Math.max(l1, l2, 200);
}

/** طول تثبيت السيخ المخطّف (Hooked Bar) - ACI 318-19 Eq. 25.4.3.1a */
export function hookedBarDevelopmentLengthMm({ dbMm, fcMPa, fyMPa, coating = 'none', coverAdequate = false, confined = false, lambda = 1.0 }) {
  const psiE = coating !== 'none' ? 1.2 : 1.0;
  const psiC = coverAdequate ? 0.7 : 1.0;
  const psiR = confined ? 0.8 : 1.0;
  const ldh = (0.24 * fyMPa * psiE * psiC * psiR * dbMm) / (lambda * Math.sqrt(fcMPa));
  return Math.max(ldh, 8 * dbMm, 150);
}

// -----------------------------------------------------------------------------
// طول التراكب (Lap Splice Length) - ACI 318 §25.5
// -----------------------------------------------------------------------------

/** طول تراكب الشد - Class A = 1.0×ld ، Class B = 1.3×ld (الافتراضي الآمن B) */
export function tensionLapLengthMm(ldMm, splitClass = 'B') {
  return splitClass === 'A' ? ldMm : 1.3 * ldMm;
}

/** طول تراكب الضغط - ACI 318 §25.5.5 */
export function compressionLapLengthMm({ dbMm, fyMPa, fcMPa }) {
  let lap = fyMPa <= 420 ? 0.071 * fyMPa * dbMm : (0.13 * fyMPa - 24) * dbMm;
  if (fcMPa < 21) lap *= 4 / 3; // زيادة الثلث عند خرسانة أضعف من 21MPa وفق الكود
  return Math.max(lap, 300);
}

// -----------------------------------------------------------------------------
// هندسة الخطافات (Hooks) - طول حقيقي (امتداد مستقيم + طول قوس الانحناء الفعلي)
// -----------------------------------------------------------------------------

/** قطر الانحناء الداخلي القياسي للحديد الرئيسي (Table 25.3.1) */
export function primaryBendDiameterMm(dbMm) {
  if (dbMm <= 25) return 6 * dbMm;
  if (dbMm <= 36) return 8 * dbMm;
  return 10 * dbMm;
}

/** قطر الانحناء الداخلي للكانات/الأربطة (Table 25.3.2) - أقطار ≤16مم=4db، أكبر=6db */
export function stirrupBendDiameterMm(dbMm) {
  return dbMm <= 16 ? 4 * dbMm : 6 * dbMm;
}

/**
 * الطول الإجمالي للخطاف (الامتداد المستقيم + طول القوس الهندسي الفعلي)
 * kind: 'primary' | 'stirrup'   angleDeg: 90 | 135 | 180
 */
export function hookLengthMm(dbMm, angleDeg, kind = 'primary') {
  const bendDiaMm = kind === 'primary' ? primaryBendDiameterMm(dbMm) : stirrupBendDiameterMm(dbMm);
  const centerlineRadiusMm = bendDiaMm / 2 + dbMm / 2; // نصف قطر محور السيخ الفعلي أثناء الانحناء
  const arcLengthMm = centerlineRadiusMm * ((angleDeg * Math.PI) / 180);

  let extensionMm;
  if (kind === 'primary') {
    extensionMm = angleDeg === 180 ? Math.max(4 * dbMm, 65) : 12 * dbMm; // 90°: 12db | 180°: أكبر من 4db أو 65مم
  } else {
    extensionMm = Math.max(6 * dbMm, 75); // كانات: 90° أو 135° كلاهما 6db بحد أدنى 75مم
  }
  return round(arcLengthMm + extensionMm, 1);
}

// -----------------------------------------------------------------------------
// تقسيم الأسياخ التجارية والتراكب - حساب حقيقي وليس تقريبياً
// -----------------------------------------------------------------------------

/**
 * يحسب عدد القطع التجارية اللازمة لتغطية طول مطلوب معين، مع أطوال التراكب الفعلية،
 * ويعيد الطول الكلي المُستهلك من الحديد التجاري (شاملاً هدر التراكب).
 */
export function splitIntoCommercialBars(requiredLengthM, lapLengthMm, commercialLengthM = COMMERCIAL_BAR_LENGTH_M) {
  if (requiredLengthM <= commercialLengthM) {
    return { pieces: 1, totalConsumedM: round(requiredLengthM, 3), splices: 0 };
  }
  const lapM = lapLengthMm / 1000;
  const effectiveLength = commercialLengthM - lapM; // كل وصلة تُنقص طولاً فعلياً بمقدار التراكب
  const splices = Math.ceil((requiredLengthM - commercialLengthM) / effectiveLength);
  const pieces = splices + 1;
  const totalConsumedM = requiredLengthM + splices * lapM;
  return { pieces, totalConsumedM: round(totalConsumedM, 3), splices };
}

/** يختار تركيبة قطر/عدد عملية لتغطية مساحة حديد مطلوبة (مشابه لمنطق القسم الأول) */
export function chooseBarCountForArea(requiredAreaMm2, { preferredDiameters = REBAR_DIAMETERS_MM, minBars = 2, maxBars = 40 } = {}) {
  if (!(requiredAreaMm2 > 0)) {
    return { diameterMm: preferredDiameters[2], count: minBars, providedAreaMm2: barAreaMm2(preferredDiameters[2]) * minBars };
  }
  let best = null;
  for (const d of preferredDiameters) {
    const oneBar = barAreaMm2(d);
    let count = Math.ceil(requiredAreaMm2 / oneBar);
    count = Math.max(count, minBars);
    if (count > maxBars) continue;
    const providedArea = count * oneBar;
    const waste = providedArea - requiredAreaMm2;
    if (!best || waste < best.waste) best = { diameterMm: d, count, providedAreaMm2: providedArea, waste };
  }
  if (!best) {
    const d = preferredDiameters[preferredDiameters.length - 1];
    const count = Math.ceil(requiredAreaMm2 / barAreaMm2(d));
    best = { diameterMm: d, count, providedAreaMm2: count * barAreaMm2(d), waste: 0 };
  }
  return best;
}

// -----------------------------------------------------------------------------
// التكلفة - كل بند مُدخل صريح من مكتبة الأسعار، بلا معامل هدر مخفي
// -----------------------------------------------------------------------------

export function calculateSteelCost({ netWeightKg, wastePct, priceList }) {
  const grossWeightKg = netWeightKg * (1 + (wastePct || 0) / 100);
  const grossWeightTon = grossWeightKg / 1000;
  const p = priceList || {};
  const steelCost = grossWeightTon * (p.steel_price_per_ton || 0);
  const cuttingCost = grossWeightTon * (p.cutting_price_per_ton || 0);
  const bendingCost = grossWeightTon * (p.bending_price_per_ton || 0);
  const installationCost = grossWeightTon * (p.installation_price_per_ton || 0);
  const transportCost = grossWeightTon * (p.transport_price_per_ton || 0);
  const subtotal = steelCost + cuttingCost + bendingCost + installationCost + transportCost;
  const afterDiscount = subtotal * (1 - (p.discount_pct || 0) / 100);
  const finalCost = afterDiscount * (1 + (p.tax_pct || 0) / 100);
  return {
    netWeightKg: round(netWeightKg, 1),
    grossWeightKg: round(grossWeightKg, 1),
    grossWeightTon: round(grossWeightTon, 3),
    steelCost: round(steelCost, 2),
    cuttingCost: round(cuttingCost, 2),
    bendingCost: round(bendingCost, 2),
    installationCost: round(installationCost, 2),
    transportCost: round(transportCost, 2),
    subtotal: round(subtotal, 2),
    discountAmount: round(subtotal - afterDiscount, 2),
    taxAmount: round(finalCost - afterDiscount, 2),
    finalCost: round(finalCost, 2),
  };
}

export function defaultPriceList() {
  return {
    name: 'قائمة أسعار افتراضية',
    steel_price_per_ton: 0,
    cutting_price_per_ton: 0,
    bending_price_per_ton: 0,
    installation_price_per_ton: 0,
    transport_price_per_ton: 0,
    tax_pct: 15,
    discount_pct: 0,
  };
}

// -----------------------------------------------------------------------------
// تجميع مجموعات الأسياخ (Bar Groups) إلى إجماليات - يُستخدم من جميع محركات BBS
// -----------------------------------------------------------------------------

/**
 * barGroups: [{ label, diameterMm, cuttingLengthM, count, piecesPerBar, note }]
 *   cuttingLengthM: طول القطعة الواحدة الفعلي (شاملاً الخطافات إن وجدت) قبل أي تقسيم تجاري
 *   count: عدد الأسياخ (الوحدات الإنشائية الكاملة الطول المطلوبة، وليس عدد القطع التجارية)
 */
export function summarizeBarGroups(barGroups, { wastePct = 3, priceList } = {}) {
  let totalWeightKg = 0;
  let totalBarCount = 0;
  const weightByDiameter = {};
  const detailedGroups = barGroups.map((g) => {
    const split = splitIntoCommercialBars(g.cuttingLengthM, g.lapLengthMm || 0);
    const totalLengthM = round(g.cuttingLengthM * g.count, 2);
    const weightKg = round(totalLengthM * barUnitWeightKgM(g.diameterMm), 2);
    const commercialBarsNeeded = Math.ceil((split.totalConsumedM * g.count) / COMMERCIAL_BAR_LENGTH_M);
    totalWeightKg += weightKg;
    totalBarCount += g.count;
    weightByDiameter[g.diameterMm] = (weightByDiameter[g.diameterMm] || 0) + weightKg;
    return {
      ...g,
      cuttingLengthM: round(g.cuttingLengthM, 3),
      totalLengthM,
      weightKg,
      piecesPerUnit: split.pieces,
      splicesPerUnit: split.splices,
      commercialBarsNeeded,
    };
  });

  const cost = calculateSteelCost({ netWeightKg: totalWeightKg, wastePct, priceList: priceList || defaultPriceList() });

  return {
    barGroups: detailedGroups,
    totals: {
      totalWeightKg: round(totalWeightKg, 1),
      totalWeightTon: round(totalWeightKg / 1000, 3),
      totalBarCount,
      wastePct,
      weightByDiameter: Object.fromEntries(Object.entries(weightByDiameter).map(([k, v]) => [k, round(v, 1)])),
      cost,
    },
  };
}
