// lib/calc/common.js
// =============================================================================
// أدوات هندسية مشتركة تُستخدم من جميع وحدات الحساب (قواعد، أعمدة، كمرات، بلاطات...)
// جميع المعادلات هنا حقيقية ومبنية على أساسات نظرية الخرسانة المسلحة القياسية
// (منهجية متوافقة مع ACI 318 / الكود السعودي SBC 304 المبني عليه) بوحدات SI:
//   القوى: kN   |   الإجهادات: MPa (N/mm²)   |   الأطوال الكبيرة: m   |   السماكات وأقطار الحديد: mm
// =============================================================================

export const STEEL_DENSITY_KG_M3 = 7850; // كثافة الفولاذ الإنشائي الحقيقية kg/m³
export const CONCRETE_UNIT_WEIGHT_KN_M3 = 25; // الوزن النوعي للخرسانة المسلحة kN/m³ (قيمة معيارية معتمدة)
export const WATER_UNIT_WEIGHT_KN_M3 = 9.81; // الوزن النوعي للماء kN/m³
export const ES_STEEL_MPA = 200000; // معامل مرونة الفولاذ MPa
export const ECU_CONCRETE = 0.003; // أقصى انفعال انضغاطي للخرسانة عند الكسر

export const STANDARD_BAR_DIAMETERS_MM = [8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32];
export const STANDARD_SPACINGS_MM = [75, 100, 125, 150, 175, 200, 225, 250, 275, 300];
export const STANDARD_STIRRUP_DIAMETERS_MM = [8, 10, 12];

// -----------------------------------------------------------------------------
// حديد التسليح: مساحة و وزن القضيب (من الهندسة المباشرة وليس من جدول جاهز)
// -----------------------------------------------------------------------------

/** مساحة مقطع سيخ حديد بالـ mm² انطلاقاً من قطره بالـ mm */
export function barAreaMm2(diameterMm) {
  return (Math.PI / 4) * diameterMm ** 2;
}

/** وزن المتر الطولي من سيخ حديد بالـ kg/m، مُشتق من الكثافة الحقيقية للفولاذ */
export function barWeightPerMeterKg(diameterMm) {
  return (barAreaMm2(diameterMm) * STEEL_DENSITY_KG_M3) / 1e6;
}

/**
 * اختيار أفضل تركيبة (قطر × عدد أسياخ) لتغطية مساحة حديد كلية مطلوبة،
 * مع الحد الأدنى لعدد الأسياخ والحد الأقصى العملي، وبأقل هدر ممكن.
 */
export function chooseBarCountForArea(requiredAreaMm2, {
  preferredDiameters = [12, 14, 16, 18, 20, 22, 25, 28, 32],
  minBars = 4,
  maxBars = 24,
} = {}) {
  if (!(requiredAreaMm2 > 0)) {
    return { diameterMm: preferredDiameters[0], count: minBars, providedAreaMm2: barAreaMm2(preferredDiameters[0]) * minBars };
  }
  let best = null;
  for (const d of preferredDiameters) {
    const oneBar = barAreaMm2(d);
    let count = Math.ceil(requiredAreaMm2 / oneBar);
    count = Math.max(count, minBars);
    if (count > maxBars) continue;
    const providedArea = count * oneBar;
    const waste = providedArea - requiredAreaMm2;
    if (!best || waste < best.waste) {
      best = { diameterMm: d, count, providedAreaMm2: providedArea, waste };
    }
  }
  if (!best) {
    // مساحة كبيرة جداً: نستخدم أكبر قطر متاح ونزيد العدد بغض النظر عن الحد الأقصى المفضل
    const d = preferredDiameters[preferredDiameters.length - 1];
    const count = Math.ceil(requiredAreaMm2 / barAreaMm2(d));
    best = { diameterMm: d, count, providedAreaMm2: count * barAreaMm2(d), waste: count * barAreaMm2(d) - requiredAreaMm2 };
  }
  return best;
}

/**
 * اختيار قطر وتباعد عملي لتسليح البلاطات/الجدران/القواعد (حديد لكل متر عرض)
 * requiredAreaMm2PerM: مساحة الحديد المطلوبة لكل متر طولي عرضاً (mm²/m)
 */
export function chooseSpacingForAreaPerMeter(requiredAreaMm2PerM, {
  preferredDiameters = [10, 12, 14, 16, 18, 20],
  maxSpacingMm = 300,
  minSpacingMm = 75,
} = {}) {
  if (!(requiredAreaMm2PerM > 0)) {
    const d = preferredDiameters[0];
    return { diameterMm: d, spacingMm: maxSpacingMm, providedAreaMm2PerM: (barAreaMm2(d) * 1000) / maxSpacingMm };
  }
  let best = null;
  for (const d of preferredDiameters) {
    const oneBar = barAreaMm2(d);
    // spacing = area of one bar * 1000mm / required area per meter
    let spacing = (oneBar * 1000) / requiredAreaMm2PerM;
    // نقرّب إلى أقرب تباعد قياسي أصغر (لضمان تحقيق المطلوب فعلياً وليس تقريبه للأعلى)
    let snapped = STANDARD_SPACINGS_MM.filter((s) => s <= spacing).sort((a, b) => b - a)[0];
    if (!snapped) snapped = minSpacingMm;
    snapped = Math.min(snapped, maxSpacingMm);
    snapped = Math.max(snapped, minSpacingMm);
    const providedAreaPerM = (oneBar * 1000) / snapped;
    const waste = providedAreaPerM - requiredAreaMm2PerM;
    if (waste < -1e-6) continue; // لا يحقق الشرط بعد التقريب
    if (!best || waste < best.waste) {
      best = { diameterMm: d, spacingMm: snapped, providedAreaMm2PerM: providedAreaPerM, waste };
    }
  }
  if (!best) {
    const d = preferredDiameters[preferredDiameters.length - 1];
    best = { diameterMm: d, spacingMm: minSpacingMm, providedAreaMm2PerM: (barAreaMm2(d) * 1000) / minSpacingMm, waste: 0 };
  }
  return best;
}

// -----------------------------------------------------------------------------
// تحقيق الأحمال (Load Combinations) - ACI 318
// -----------------------------------------------------------------------------

export function factoredLoad(deadKN, liveKN, { deadFactor = 1.2, liveFactor = 1.6 } = {}) {
  return deadFactor * (deadKN || 0) + liveFactor * (liveKN || 0);
}

export function serviceLoad(deadKN, liveKN) {
  return (deadKN || 0) + (liveKN || 0);
}

// -----------------------------------------------------------------------------
// خواص الخرسانة المشتقة من مقاومتها (ACI 318)
// -----------------------------------------------------------------------------

/** عامل كتلة الإجهاد المكافئ β1 - يعتمد على مقاومة الخرسانة fc' (MPa) */
export function beta1Factor(fcMPa) {
  if (fcMPa <= 28) return 0.85;
  const b1 = 0.85 - 0.05 * ((fcMPa - 28) / 7);
  return Math.max(0.65, b1);
}

/** نسبة التسليح المتوازنة ρb */
export function balancedRatio(fcMPa, fyMPa) {
  const b1 = beta1Factor(fcMPa);
  return (0.85 * b1 * fcMPa) / fyMPa * (600 / (600 + fyMPa));
}

/** أقصى نسبة تسليح مسموحة (طريقة 0.75ρb المبسطة والمعتمدة تقليدياً لضمان مقطع تحكمه الشدّية) */
export function maxSteelRatio(fcMPa, fyMPa) {
  return 0.75 * balancedRatio(fcMPa, fyMPa);
}

/** أقل نسبة تسليح للعناصر المعرضة للانحناء (كمرات) - ACI 318 9.6.1.2 */
export function minFlexuralSteelRatio(fcMPa, fyMPa) {
  return Math.max(0.25 * Math.sqrt(fcMPa) / fyMPa, 1.4 / fyMPa);
}

/** أقل تسليح انكماش/حرارة للبلاطات (لكل متر عرض) - يعتمد على إجهاد الخضوع */
export function shrinkageTempRatio(fyMPa) {
  const base = fyMPa >= 420 ? 0.0018 : 0.0018 * (420 / fyMPa);
  return Math.max(base, 0.0014);
}

/**
 * حل مساحة حديد التسليح المطلوبة لمقطع معرض لعزم Mu (طريقة المقاومة القصوى Rn-ρ)
 * bMm, dMm بالمليمتر، MuKNm بالـ kN.m، fcMPa و fyMPa بالـ MPa
 */
export function solveFlexuralSteel({ MuKNm, bMm, dMm, fcMPa, fyMPa, phi = 0.9, rhoMinOverride = null }) {
  if (!(MuKNm > 0) || !(bMm > 0) || !(dMm > 0)) {
    return { isValid: false, reason: 'قيم غير كافية لحل التسليح', rho: 0, asMm2: 0 };
  }
  const MuNmm = MuKNm * 1e6; // kN.m -> N.mm
  const Rn = MuNmm / (phi * bMm * dMm ** 2); // N/mm² = MPa
  const term = 1 - (2 * Rn) / (0.85 * fcMPa);
  if (term < 0) {
    return {
      isValid: false,
      reason: 'المقطع غير كافٍ لتحمل العزم المطلوب (Rn كبير جداً) - يلزم زيادة الأبعاد أو مقاومة الخرسانة',
      Rn,
      rho: null,
      asMm2: null,
    };
  }
  const rho = (0.85 * fcMPa / fyMPa) * (1 - Math.sqrt(term));
  const rhoMin = rhoMinOverride != null ? rhoMinOverride : minFlexuralSteelRatio(fcMPa, fyMPa);
  const rhoMax = maxSteelRatio(fcMPa, fyMPa);
  const rhoUsed = Math.max(rho, rhoMin);
  const asMm2 = rhoUsed * bMm * dMm;
  return {
    isValid: rhoUsed <= rhoMax,
    reason: rhoUsed > rhoMax ? 'نسبة التسليح المطلوبة تتجاوز الحد الأقصى المسموح - يلزم مقطع أكبر أو تسليح ضغط' : null,
    Rn,
    rho,
    rhoMin,
    rhoMax,
    rhoUsed,
    asMm2,
    governedByMinimum: rho < rhoMin,
  };
}

// -----------------------------------------------------------------------------
// القص أحادي الاتجاه (كمرات، بلاطات أحادية، شرائح القواعد)
// -----------------------------------------------------------------------------

/** مقاومة القص للخرسانة وحدها (بدون كانات) - المعادلة المبسطة ACI 318 22.5.5.1 */
export function oneWayShearCapacityKN({ bwMm, dMm, fcMPa, phi = 0.75 }) {
  const VcN = 0.17 * Math.sqrt(fcMPa) * bwMm * dMm; // N
  return { VcKN: VcN / 1000, phiVcKN: (phi * VcN) / 1000 };
}

/** تصميم الكانات (تسليح القص) لكمرة/جدار عندما Vu > φVc */
export function designStirrups({ VuKN, phiVcKN, VcKN, bwMm, dMm, fcMPa, fyMPa, phi = 0.75, stirrupDiaMm = 10, legs = 2 }) {
  if (VuKN <= phiVcKN / 2) {
    return { required: false, note: 'لا حاجة لكانات حسابياً (Vu ≤ φVc/2)، يُفضّل وضع كانات إنشائية دنيا' };
  }
  const AvMm2 = legs * barAreaMm2(stirrupDiaMm);
  if (VuKN <= phiVcKN) {
    // كانات إنشائية دنيا فقط (Vu بين φVc/2 و φVc)
    const sMaxMm = Math.min(dMm / 2, 600);
    return { required: true, minimumOnly: true, AvMm2, spacingMm: Math.floor(sMaxMm / 25) * 25, stirrupDiaMm, legs };
  }
  const VsReqKN = VuKN / phi - VcKN;
  const VsThresholdKN = (0.33 * Math.sqrt(fcMPa) * bwMm * dMm) / 1000; // حد تغيّر أقصى تباعد مسموح
  const VsMaxKN = (0.66 * Math.sqrt(fcMPa) * bwMm * dMm) / 1000; // أقصى Vs مسموح به قبل وجوب تكبير المقطع
  if (VsReqKN > VsMaxKN) {
    return {
      required: true,
      sectionTooSmall: true,
      VsReqKN,
      VsMaxKN,
      note: 'قوة القص المطلوبة تتجاوز أقصى قدرة يمكن للكانات تعويضها - يلزم تكبير أبعاد المقطع',
    };
  }
  const spacingMm = (AvMm2 * fyMPa * dMm) / (VsReqKN * 1000);
  const sMax = VsReqKN > VsThresholdKN ? Math.min(dMm / 4, 300) : Math.min(dMm / 2, 600);
  const finalSpacing = Math.max(50, Math.min(spacingMm, sMax));
  const snapped = STANDARD_SPACINGS_MM.filter((s) => s <= finalSpacing).sort((a, b) => b - a)[0] || 75;
  return {
    required: true,
    minimumOnly: false,
    VsReqKN,
    VsMaxKN,
    AvMm2,
    spacingMm: snapped,
    stirrupDiaMm,
    legs,
  };
}

// -----------------------------------------------------------------------------
// القص الثاقب (Punching Shear) ثنائي الاتجاه - القواعد المنفصلة، اللبشة، البلاطات الفطرية
// المعادلة الكاملة ACI 318 22.6.5.2 (أصغر ثلاث قيم)
// -----------------------------------------------------------------------------

/**
 * فحص القص الثاقب حول عمود/حمل مركّز
 * c1Mm, c2Mm: أبعاد العمود، dMm: العمق الفعال، fcMPa: مقاومة الخرسانة
 * columnType: 'interior' | 'edge' | 'corner'
 */
export function punchingShearCapacityKN({ c1Mm, c2Mm, dMm, fcMPa, columnType = 'interior' }) {
  const b0 = 2 * (c1Mm + dMm) + 2 * (c2Mm + dMm); // محيط المقطع الحرج على بعد d/2 من وجه العمود
  const betaC = Math.max(c1Mm, c2Mm) / Math.min(c1Mm, c2Mm);
  const alphaS = columnType === 'interior' ? 40 : columnType === 'edge' ? 30 : 20;

  const Vc1 = 0.17 * (1 + 2 / betaC) * Math.sqrt(fcMPa) * b0 * dMm;
  const Vc2 = 0.083 * (alphaS * dMm / b0 + 2) * Math.sqrt(fcMPa) * b0 * dMm;
  const Vc3 = 0.33 * Math.sqrt(fcMPa) * b0 * dMm;
  const VcN = Math.min(Vc1, Vc2, Vc3);
  const phi = 0.75;
  return {
    b0Mm: b0,
    betaC,
    alphaS,
    VcKN: VcN / 1000,
    phiVcKN: (phi * VcN) / 1000,
    governing: Vc1 <= Vc2 && Vc1 <= Vc3 ? 'βc' : Vc2 <= Vc3 ? 'αs·d/b0' : 'الحد الأعلى 0.33√fc',
  };
}

// -----------------------------------------------------------------------------
// أدوات عامة: تحقق من صحة المدخلات + تقريب
// -----------------------------------------------------------------------------

export function round(value, decimals = 2) {
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
}

export class ValidationError extends Error {
  constructor(messages) {
    super(Array.isArray(messages) ? messages.join(' | ') : messages);
    this.name = 'ValidationError';
    this.messages = Array.isArray(messages) ? messages : [messages];
  }
}

/** يتحقق من أن جميع الحقول المطلوبة أرقام موجبة (أو صفر إن سُمح بذلك)، ويجمع كل الأخطاء دفعة واحدة */
export function validateNumbers(fields) {
  const errors = [];
  for (const [labelAr, value, opts = {}] of fields) {
    const { allowZero = false, allowNegative = false, required = true } = opts;
    if (value === undefined || value === null || value === '') {
      if (required) errors.push(`الحقل "${labelAr}" مطلوب.`);
      continue;
    }
    const num = Number(value);
    if (Number.isNaN(num)) {
      errors.push(`الحقل "${labelAr}" يجب أن يكون رقماً صحيحاً.`);
      continue;
    }
    if (!allowNegative && num < 0) errors.push(`الحقل "${labelAr}" لا يمكن أن يكون سالباً.`);
    if (!allowZero && num === 0) errors.push(`الحقل "${labelAr}" لا يمكن أن يساوي صفراً.`);
  }
  if (errors.length) throw new ValidationError(errors);
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
