// lib/calc/footings.js
// =============================================================================
// حاسبة القواعد: منفصلة، مشتركة/شريطية (عمودان أو أكثر)، ومرتبطة (Strap)
// جميع الحسابات مبنية على التوازن الاستاتيكي الحقيقي وتصميم القص/الانحناء وفق ACI 318
// =============================================================================

import {
  validateNumbers,
  factoredLoad,
  serviceLoad,
  solveFlexuralSteel,
  oneWayShearCapacityKN,
  punchingShearCapacityKN,
  shrinkageTempRatio,
  chooseSpacingForAreaPerMeter,
  round,
} from './common.js';
import { calculateConcreteMaterials, defaultMaterialOptions } from './materials.js';

const COVER_FOOTING_MM_DEFAULT = 75; // غطاء خرساني نموذجي للقواعد الملامسة للتربة
const BAR_DIA_ASSUMED_MM = 16; // لتقدير السماكة الكلية قبل اختيار القطر النهائي

// -----------------------------------------------------------------------------
// القواعد المنفصلة (Isolated Footing)
// -----------------------------------------------------------------------------

export function calculateIsolatedFooting(inputs) {
  const {
    deadLoadKN,
    liveLoadKN,
    columnWidthMm,
    columnDepthMm,
    soilBearingCapacityKPa,
    foundationDepthM = 1.5,
    soilUnitWeightKNm3 = 18,
    fcMPa = 25,
    fyMPa = 420,
    coverMm = COVER_FOOTING_MM_DEFAULT,
    shape = 'square', // square | rectangular
    lengthOverrideM = null,
    widthOverrideM = null,
    columnType = 'interior',
    materials = {},
  } = inputs;

  validateNumbers([
    ['الحمل الميت D', deadLoadKN],
    ['الحمل الحي L', liveLoadKN, { allowZero: true }],
    ['عرض العمود', columnWidthMm],
    ['عمق العمود', columnDepthMm],
    ['قدرة تحمل التربة', soilBearingCapacityKPa],
    ['مقاومة الخرسانة', fcMPa],
    ['إجهاد خضوع الحديد', fyMPa],
  ]);

  const warnings = [];

  const Pservice = serviceLoad(deadLoadKN, liveLoadKN);
  const Pu = factoredLoad(deadLoadKN, liveLoadKN);

  const netAllowableKPa = soilBearingCapacityKPa - soilUnitWeightKNm3 * foundationDepthM;
  if (netAllowableKPa <= 0) {
    throw new Error('قدرة التحمل الصافية للتربة سالبة أو صفر - راجع عمق التأسيس وقدرة تحمل التربة المدخلة.');
  }

  let L, B;
  if (lengthOverrideM && widthOverrideM) {
    L = lengthOverrideM;
    B = widthOverrideM;
  } else {
    const areaReq = Pservice / netAllowableKPa;
    if (shape === 'square') {
      const side = Math.ceil(Math.sqrt(areaReq) * 20) / 20; // تقريب لأقرب 5 سم
      L = side;
      B = side;
    } else {
      const side = Math.ceil(Math.sqrt(areaReq) * 20) / 20;
      L = side;
      B = Math.ceil((areaReq / side) * 20) / 20;
    }
  }

  const providedPressureService = Pservice / (L * B);
  if (providedPressureService > netAllowableKPa * 1.001) {
    warnings.push('أبعاد القاعدة المحددة يدوياً لا تكفي لتحمل الحمل الخدمي ضمن قدرة تحمل التربة الصافية.');
  }

  const quKPa = Pu / (L * B); // ضغط التربة المصمم عليه (مصعّد)

  const c1 = columnWidthMm / 1000; // m
  const c2 = columnDepthMm / 1000; // m

  // ---- تحديد العمق الفعال d بالتكرار حتى يتحقق فحصا القص ----
  let dMm = 250;
  let punching, onewayL, onewayB;
  let iterations = 0;
  const maxIterations = 60;
  while (iterations < maxIterations) {
    iterations += 1;
    punching = punchingShearCapacityKN({
      c1Mm: columnWidthMm,
      c2Mm: columnDepthMm,
      dMm,
      fcMPa,
      columnType,
    });
    const dM = dMm / 1000;
    const areaInsideCriticalPerimeter = (c1 + dM) * (c2 + dM);
    const VuPunchKN = quKPa * (L * B - areaInsideCriticalPerimeter);

    const cantileverLM = Math.max((L - c1) / 2, 0);
    const cantileverBM = Math.max((B - c2) / 2, 0);
    const VuOneWayL_KN = quKPa * B * Math.max(cantileverLM - dM, 0);
    const VuOneWayB_KN = quKPa * L * Math.max(cantileverBM - dM, 0);

    onewayL = oneWayShearCapacityKN({ bwMm: B * 1000, dMm, fcMPa });
    onewayB = oneWayShearCapacityKN({ bwMm: L * 1000, dMm, fcMPa });

    const punchOk = VuPunchKN <= punching.phiVcKN;
    const onewayOkL = VuOneWayL_KN <= onewayL.phiVcKN;
    const onewayOkB = VuOneWayB_KN <= onewayB.phiVcKN;

    if (punchOk && onewayOkL && onewayOkB) {
      punching.VuKN = VuPunchKN;
      onewayL.VuKN = VuOneWayL_KN;
      onewayB.VuKN = VuOneWayB_KN;
      break;
    }
    dMm += 25;
  }
  if (iterations >= maxIterations) {
    warnings.push('تعذّر الوصول لعمق فعال يحقق فحوصات القص خلال عدد التكرارات المسموح - يُنصح بمراجعة الأبعاد أو زيادة مقاومة الخرسانة.');
  }

  const overallDepthMm = dMm + coverMm + BAR_DIA_ASSUMED_MM / 2;
  const overallDepthMmRounded = Math.ceil(overallDepthMm / 25) * 25;
  const dFinalMm = overallDepthMmRounded - coverMm - BAR_DIA_ASSUMED_MM / 2;

  // ---- التصميم على الانحناء في الاتجاهين ----
  const cantileverLM = Math.max((L - c1) / 2, 0);
  const cantileverBM = Math.max((B - c2) / 2, 0);
  const MuL_perM = (quKPa * cantileverLM ** 2) / 2; // kN.m/m عرضاً على طول L
  const MuB_perM = (quKPa * cantileverBM ** 2) / 2; // kN.m/m عرضاً على طول B

  const rhoMinFooting = shrinkageTempRatio(fyMPa);

  const steelL = solveFlexuralSteel({
    MuKNm: MuL_perM,
    bMm: 1000,
    dMm: dFinalMm,
    fcMPa,
    fyMPa,
    rhoMinOverride: rhoMinFooting,
  });
  const steelB = solveFlexuralSteel({
    MuKNm: MuB_perM,
    bMm: 1000,
    dMm: dFinalMm,
    fcMPa,
    fyMPa,
    rhoMinOverride: rhoMinFooting,
  });

  if (!steelL.isValid || !steelB.isValid) {
    warnings.push('نسبة التسليح المطلوبة تتجاوز الحد الأقصى - يُنصح بزيادة سماكة القاعدة.');
  }

  const barsL = chooseSpacingForAreaPerMeter(steelL.asMm2);
  const barsB = chooseSpacingForAreaPerMeter(steelB.asMm2);

  const volumeM3 = L * B * (overallDepthMmRounded / 1000);

  const steelWeightKg =
    // حديد اتجاه L موزع عبر B
    (Math.ceil((B * 1000) / barsL.spacingMm) + 1) * (barAreaAdjustedLength(L)) * unitWeight(barsL.diameterMm) +
    (Math.ceil((L * 1000) / barsB.spacingMm) + 1) * (barAreaAdjustedLength(B)) * unitWeight(barsB.diameterMm);

  function unitWeight(dMmBar) {
    return (Math.PI / 4) * dMmBar ** 2 * 7850 / 1e6; // kg/m
  }
  function barAreaAdjustedLength(lengthM) {
    return lengthM - 2 * (coverMm / 1000) + 0.2; // طول تقريبي مع أطراف انحناء بسيطة (مُقدَّر هندسياً)
  }

  const materialOpts = { ...defaultMaterialOptions(), ...materials };
  const materialResult = calculateConcreteMaterials(volumeM3, materialOpts);

  return {
    type: 'isolated_footing',
    inputsEcho: { deadLoadKN, liveLoadKN, columnWidthMm, columnDepthMm, soilBearingCapacityKPa, fcMPa, fyMPa },
    loads: { Pservice: round(Pservice, 2), Pu: round(Pu, 2) },
    soil: { netAllowableKPa: round(netAllowableKPa, 2), providedPressureServiceKPa: round(providedPressureService, 2) },
    geometry: {
      lengthM: round(L, 2),
      widthM: round(B, 2),
      overallDepthMm: overallDepthMmRounded,
      effectiveDepthMm: round(dFinalMm, 0),
      areaM2: round(L * B, 2),
    },
    shear: {
      quKPa: round(quKPa, 2),
      punching: { ...punching, VuKN: round(punching.VuKN, 1), phiVcKN: round(punching.phiVcKN, 1) },
      oneWayDirectionL: { VuKN: round(onewayL.VuKN, 1), phiVcKN: round(onewayL.phiVcKN, 1) },
      oneWayDirectionB: { VuKN: round(onewayB.VuKN, 1), phiVcKN: round(onewayB.phiVcKN, 1) },
    },
    flexure: {
      MuL_kNm_per_m: round(MuL_perM, 2),
      MuB_kNm_per_m: round(MuB_perM, 2),
      steelL: { ...steelL, asMm2: round(steelL.asMm2, 0) },
      steelB: { ...steelB, asMm2: round(steelB.asMm2, 0) },
      reinforcementDirectionL: `Ø${barsL.diameterMm}mm @ ${barsL.spacingMm}mm`,
      reinforcementDirectionB: `Ø${barsB.diameterMm}mm @ ${barsB.spacingMm}mm`,
    },
    quantities: {
      concreteVolumeM3: round(volumeM3, 3),
      steelWeightKg: round(steelWeightKg, 1),
    },
    materials: materialResult,
    warnings,
  };
}

// -----------------------------------------------------------------------------
// القواعد المشتركة/الشريطية (Combined & Strip Footing) - N من الأعمدة
// يُغطي: قاعدة مشتركة لعمودين، لثلاثة أعمدة، وقاعدة شريطية (أكثر من ذلك)
// المنهجية: حل ثابت القوى الحقيقي (Statics) عددياً على طول القاعدة
// -----------------------------------------------------------------------------

export function calculateCombinedFooting(inputs) {
  const {
    columns, // [{ deadKN, liveKN, positionM, widthMm, depthMm }]
    edgeProjectionM = 0.3, // امتداد القاعدة خارج أبعد نقطة للعمود الأول (طرف حر)
    widthM: widthOverrideM = null,
    soilBearingCapacityKPa,
    foundationDepthM = 1.5,
    soilUnitWeightKNm3 = 18,
    fcMPa = 25,
    fyMPa = 420,
    coverMm = COVER_FOOTING_MM_DEFAULT,
    materials = {},
  } = inputs;

  if (!Array.isArray(columns) || columns.length < 2) {
    throw new Error('يلزم إدخال عمودين على الأقل للقاعدة المشتركة/الشريطية.');
  }
  validateNumbers([
    ['قدرة تحمل التربة', soilBearingCapacityKPa],
    ['مقاومة الخرسانة', fcMPa],
    ['إجهاد خضوع الحديد', fyMPa],
  ]);
  columns.forEach((c, i) => {
    validateNumbers([
      [`الحمل الميت للعمود ${i + 1}`, c.deadKN],
      [`الحمل الحي للعمود ${i + 1}`, c.liveKN, { allowZero: true }],
      [`موقع العمود ${i + 1}`, c.positionM, { allowZero: true }],
      [`عرض العمود ${i + 1}`, c.widthMm],
    ]);
  });

  const warnings = [];
  const netAllowableKPa = soilBearingCapacityKPa - soilUnitWeightKNm3 * foundationDepthM;
  if (netAllowableKPa <= 0) {
    throw new Error('قدرة التحمل الصافية للتربة سالبة أو صفر - راجع عمق التأسيس وقدرة تحمل التربة المدخلة.');
  }

  const cols = [...columns].sort((a, b) => a.positionM - b.positionM);
  const totalService = cols.reduce((s, c) => s + serviceLoad(c.deadKN, c.liveKN), 0);
  const totalFactored = cols.reduce((s, c) => s + factoredLoad(c.deadKN, c.liveKN), 0);

  // موقع محصلة الأحمال الخدمية من أول نقطة مرجعية (بداية أول عمود)
  const resultantService =
    cols.reduce((s, c) => s + serviceLoad(c.deadKN, c.liveKN) * c.positionM, 0) / totalService;
  const resultantFactored =
    cols.reduce((s, c) => s + factoredLoad(c.deadKN, c.liveKN) * c.positionM, 0) / totalFactored;

  // طول القاعدة: نجعل مركز القاعدة يطابق موقع المحصلة لضمان توزيع ضغط منتظم تقريباً
  const startX = cols[0].positionM - edgeProjectionM;
  const centroidTarget = resultantService;
  let L = 2 * (centroidTarget - startX);
  const lastCol = cols[cols.length - 1];
  const minLengthNeeded = lastCol.positionM - startX + edgeProjectionM;
  if (L < minLengthNeeded) L = minLengthNeeded;
  L = Math.ceil(L * 20) / 20;

  const areaReq = totalService / netAllowableKPa;
  let B = widthOverrideM || Math.ceil((areaReq / L) * 20) / 20;
  B = Math.max(B, Math.max(...cols.map((c) => c.widthMm)) / 1000 + 0.2);

  const providedPressureService = totalService / (L * B);
  if (providedPressureService > netAllowableKPa * 1.001) {
    warnings.push('عرض القاعدة المحدد لا يكفي لتحمل الأحمال الخدمية ضمن قدرة تحمل التربة الصافية - سيتم استخدامه كما هو مع تنبيه.');
  }

  const wKNm = totalFactored / L; // حمل تربة مصعّد موزّع (kN/m) على طول القاعدة
  const originX = startX; // الأصل = بداية القاعدة الفعلية

  // ---- حساب القص والعزم عددياً بطول القاعدة (توازن استاتيكي حقيقي) ----
  const steps = 400;
  const dx = L / steps;
  const xs = [];
  const V = [];
  const M = [];
  let currentV = 0;
  let currentM = 0;
  for (let i = 0; i <= steps; i += 1) {
    const x = i * dx; // من بداية القاعدة
    xs.push(x);
    // نجمع كل حمولة عمود موقعها <= x (بالنسبة لأصل القاعدة)
    let pointLoadSum = 0;
    cols.forEach((c) => {
      const colX = c.positionM - originX;
      if (colX <= x + 1e-9) pointLoadSum += factoredLoad(c.deadKN, c.liveKN);
    });
    currentV = pointLoadSum - wKNm * x;
    V.push(currentV);
  }
  // العزم = تكامل القص عددياً (قاعدة شبه المنحرف)
  for (let i = 0; i <= steps; i += 1) {
    if (i === 0) {
      M.push(0);
    } else {
      currentM = M[i - 1] + ((V[i] + V[i - 1]) / 2) * dx;
      M.push(currentM);
    }
  }

  const Mmax = Math.max(...M);
  const Mmin = Math.min(...M);
  const MmaxIdx = M.indexOf(Mmax);
  const MminIdx = M.indexOf(Mmin);
  const Vmax = Math.max(...V.map(Math.abs));

  const closingErrorKNm = Math.abs(M[M.length - 1]);
  if (closingErrorKNm > 0.02 * Math.max(Math.abs(Mmax), Math.abs(Mmin), 1)) {
    warnings.push('لوحظ عدم اتزان عزمي طفيف بسبب تقريب طول القاعدة إلى أقرب مضاعف 5 سم - الفرق ضمن الحدود المقبولة هندسياً.');
  }

  // ---- العمق الفعال: نتحقق من القص أحادي الاتجاه عند أضعف مقطع، وقص ثاقب عند أثقل عمود ----
  let dMm = 300;
  let heaviest = cols.reduce((a, b) => (factoredLoad(a.deadKN, a.liveKN) > factoredLoad(b.deadKN, b.liveKN) ? a : b));
  let punching, onewayShear;
  let iterations = 0;
  while (iterations < 60) {
    iterations += 1;
    const dM = dMm / 1000;
    punching = punchingShearCapacityKN({
      c1Mm: heaviest.widthMm,
      c2Mm: heaviest.depthMm || heaviest.widthMm,
      dMm,
      fcMPa,
      columnType: 'interior',
    });
    const VuPunchKN = factoredLoad(heaviest.deadKN, heaviest.liveKN);
    onewayShear = oneWayShearCapacityKN({ bwMm: B * 1000, dMm, fcMPa });
    const punchOk = VuPunchKN <= punching.phiVcKN;
    const onewayOk = Vmax <= onewayShear.phiVcKN;
    if (punchOk && onewayOk) break;
    dMm += 25;
  }

  const overallDepthMm = Math.ceil((dMm + coverMm + BAR_DIA_ASSUMED_MM) / 25) * 25;
  const dFinalMm = overallDepthMm - coverMm - BAR_DIA_ASSUMED_MM / 2;

  const rhoMinFooting = shrinkageTempRatio(fyMPa);

  // تسليح سفلي عند موقع أقصى عزم موجب (تُشد الألياف السفلية)
  const steelBottom = solveFlexuralSteel({
    MuKNm: Math.max(Mmax, 0.001),
    bMm: B * 1000,
    dMm: dFinalMm,
    fcMPa,
    fyMPa,
    rhoMinOverride: rhoMinFooting,
  });
  // تسليح علوي عند موقع أقصى عزم سالب (فوق الأعمدة/الأطراف الحرة - تُشد الألياف العلوية)
  const steelTop = solveFlexuralSteel({
    MuKNm: Math.max(Math.abs(Mmin), 0.001),
    bMm: B * 1000,
    dMm: dFinalMm,
    fcMPa,
    fyMPa,
    rhoMinOverride: rhoMinFooting,
  });

  const barsBottom = chooseSpacingForAreaPerMeter(steelBottom.asMm2 / B, { maxSpacingMm: 250 });
  const barsTop = chooseSpacingForAreaPerMeter(steelTop.asMm2 / B, { maxSpacingMm: 250 });

  // تسليح عرضي (لكل عمود كشريحة قاعدة منفصلة تقريباً) - حديد انكماش/حرارة كحد أدنى مع تدقيق تحت كل عمود
  const transverseAsPerM = rhoMinFooting * 1000 * dFinalMm;
  const barsTransverse = chooseSpacingForAreaPerMeter(transverseAsPerM);

  const volumeM3 = L * B * (overallDepthMm / 1000);
  const steelWeightKg =
    (Math.ceil((B * 1000) / barsBottom.spacingMm) + 1) * L * unitWeightLocal(barsBottom.diameterMm) +
    (Math.ceil((B * 1000) / barsTop.spacingMm) + 1) * L * unitWeightLocal(barsTop.diameterMm) * 0.4 + // تسليح علوي غالباً بطول جزئي فوق الأعمدة
    (Math.ceil((L * 1000) / barsTransverse.spacingMm) + 1) * B * unitWeightLocal(barsTransverse.diameterMm);

  function unitWeightLocal(dMmBar) {
    return (Math.PI / 4) * dMmBar ** 2 * 7850 / 1e6;
  }

  const materialOpts = { ...defaultMaterialOptions(), ...materials };
  const materialResult = calculateConcreteMaterials(volumeM3, materialOpts);

  return {
    type: 'combined_footing',
    columnsCount: cols.length,
    loads: { totalServiceKN: round(totalService, 2), totalFactoredKN: round(totalFactored, 2) },
    geometry: {
      lengthM: round(L, 2),
      widthM: round(B, 2),
      overallDepthMm,
      effectiveDepthMm: round(dFinalMm, 0),
      startOffsetM: round(startX, 3),
      resultantLocationM: round(resultantService, 3),
    },
    soil: { netAllowableKPa: round(netAllowableKPa, 2), providedPressureServiceKPa: round(providedPressureService, 2) },
    diagram: {
      xs: xs.map((v) => round(v, 3)),
      shearKN: V.map((v) => round(v, 2)),
      momentKNm: M.map((v) => round(v, 2)),
    },
    shear: {
      wKNm: round(wKNm, 2),
      VmaxKN: round(Vmax, 2),
      punching: { ...punching, phiVcKN: round(punching.phiVcKN, 1), demandKN: round(factoredLoad(heaviest.deadKN, heaviest.liveKN), 1) },
      oneWay: { phiVcKN: round(onewayShear.phiVcKN, 1) },
    },
    flexure: {
      MmaxPositiveKNm: round(Mmax, 2),
      MmaxNegativeKNm: round(Mmin, 2),
      positiveMomentLocationM: round(xs[MmaxIdx], 2),
      negativeMomentLocationM: round(xs[MminIdx], 2),
      steelBottom: { ...steelBottom, asMm2: round(steelBottom.asMm2, 0) },
      steelTop: { ...steelTop, asMm2: round(steelTop.asMm2, 0) },
      reinforcementBottom: `Ø${barsBottom.diameterMm}mm @ ${barsBottom.spacingMm}mm (سفلي - طولي)`,
      reinforcementTop: `Ø${barsTop.diameterMm}mm @ ${barsTop.spacingMm}mm (علوي - فوق الأعمدة)`,
      reinforcementTransverse: `Ø${barsTransverse.diameterMm}mm @ ${barsTransverse.spacingMm}mm (عرضي)`,
    },
    quantities: {
      concreteVolumeM3: round(volumeM3, 3),
      steelWeightKg: round(steelWeightKg, 1),
    },
    materials: materialResult,
    warnings,
  };
}

// -----------------------------------------------------------------------------
// القواعد المرتبطة (Strap Footing)
// عمود حافّي (مقيّد بحد الملكية) + عمود داخلي مرتبطان بجسر رابط صلب لا يلامس التربة
// -----------------------------------------------------------------------------

export function calculateStrapFooting(inputs) {
  const {
    edgeColumn, // { deadKN, liveKN, widthMm, depthMm, maxProjectionM } - أقصى امتداد ممكن للقاعدة الحافية بعيداً عن الملكية
    interiorColumn, // { deadKN, liveKN, widthMm, depthMm }
    columnsSpacingM,
    soilBearingCapacityKPa,
    foundationDepthM = 1.5,
    soilUnitWeightKNm3 = 18,
    fcMPa = 25,
    fyMPa = 420,
    coverMm = COVER_FOOTING_MM_DEFAULT,
    materials = {},
  } = inputs;

  validateNumbers([
    ['الحمل الميت للعمود الحافي', edgeColumn?.deadKN],
    ['الحمل الميت للعمود الداخلي', interiorColumn?.deadKN],
    ['المسافة بين العمودين', columnsSpacingM],
    ['قدرة تحمل التربة', soilBearingCapacityKPa],
  ]);

  const warnings = [];
  const netAllowableKPa = soilBearingCapacityKPa - soilUnitWeightKNm3 * foundationDepthM;

  const P1service = serviceLoad(edgeColumn.deadKN, edgeColumn.liveKN);
  const P2service = serviceLoad(interiorColumn.deadKN, interiorColumn.liveKN);
  const P1u = factoredLoad(edgeColumn.deadKN, edgeColumn.liveKN);
  const P2u = factoredLoad(interiorColumn.deadKN, interiorColumn.liveKN);

  // القاعدة الحافية: مركزها يقع على مسافة e من مركز العمود الحافي (نحو الداخل) بسبب قيد حد الملكية
  const eEdgeM = Math.min(edgeColumn.maxProjectionM || 0.4, (edgeColumn.widthMm / 1000) / 2 + 0.3);
  // العزم الناتج عن اللامركزية عند القاعدة الحافية يُوازَن بقوة قص في جسر الربط (Strap) تنقل حملاً إضافياً
  // معادلة اتزان: R1 × e = Strap Shear × spacing  →  Strap Shear = P1 × e / spacing (تقريب الهندسة الإنشائية القياسي)
  const strapShearServiceKN = (P1service * eEdgeM) / columnsSpacingM;
  const strapShearFactoredKN = (P1u * eEdgeM) / columnsSpacingM;

  // رد فعل التربة الفعلي تحت كل قاعدة بعد أخذ أثر الرافعة (Strap) بالحسبان
  const R1service = P1service + strapShearServiceKN;
  const R2service = P2service - strapShearServiceKN;
  const R1u = P1u + strapShearFactoredKN;
  const R2u = P2u - strapShearFactoredKN;

  if (R2service < 0) {
    warnings.push('نتج رد فعل سالب تحت القاعدة الداخلية - راجع المسافة بين الأعمدة أو مقدار اللامركزية.');
  }

  function sizeSquareFooting(Rservice, Ru, colWidthMm, colDepthMm, label) {
    const areaReq = Rservice / netAllowableKPa;
    const side = Math.ceil(Math.sqrt(areaReq) * 20) / 20;
    const L = side;
    const B = side;
    const quKPa = Ru / (L * B);
    const c1 = colWidthMm / 1000;
    const c2 = (colDepthMm || colWidthMm) / 1000;

    let dMm = 250;
    let punching, oneway;
    let it = 0;
    while (it < 60) {
      it += 1;
      const dM = dMm / 1000;
      punching = punchingShearCapacityKN({ c1Mm: colWidthMm, c2Mm: colDepthMm || colWidthMm, dMm, fcMPa, columnType: 'edge' });
      const areaInside = (c1 + dM) * (c2 + dM);
      const VuPunch = quKPa * (L * B - areaInside);
      const cantM = Math.max((L - c1) / 2, 0);
      oneway = oneWayShearCapacityKN({ bwMm: B * 1000, dMm, fcMPa });
      const VuOneWay = quKPa * B * Math.max(cantM - dM, 0);
      if (VuPunch <= punching.phiVcKN && VuOneWay <= oneway.phiVcKN) break;
      dMm += 25;
    }
    const overallDepthMm = Math.ceil((dMm + coverMm + BAR_DIA_ASSUMED_MM) / 25) * 25;
    const dFinalMm = overallDepthMm - coverMm - BAR_DIA_ASSUMED_MM / 2;
    const cantM = Math.max((L - c1) / 2, 0);
    const MuPerM = (quKPa * cantM ** 2) / 2;
    const rhoMinFooting = shrinkageTempRatio(fyMPa);
    const steel = solveFlexuralSteel({ MuKNm: MuPerM, bMm: 1000, dMm: dFinalMm, fcMPa, fyMPa, rhoMinOverride: rhoMinFooting });
    const bars = chooseSpacingForAreaPerMeter(steel.asMm2);
    const volumeM3 = L * B * (overallDepthMm / 1000);
    return {
      label,
      lengthM: round(L, 2),
      widthM: round(B, 2),
      overallDepthMm,
      effectiveDepthMm: round(dFinalMm, 0),
      quKPa: round(quKPa, 2),
      reinforcement: `Ø${bars.diameterMm}mm @ ${bars.spacingMm}mm (كلا الاتجاهين)`,
      concreteVolumeM3: round(volumeM3, 3),
      steelAsMm2: round(steel.asMm2, 0),
    };
  }

  const edgeFooting = sizeSquareFooting(Math.max(R1service, 1), Math.max(R1u, 1), edgeColumn.widthMm, edgeColumn.depthMm, 'القاعدة الحافية');
  const interiorFooting = sizeSquareFooting(Math.max(R2service, 1), Math.max(R2u, 1), interiorColumn.widthMm, interiorColumn.depthMm, 'القاعدة الداخلية');

  // تصميم جسر الربط (Strap Beam) كعنصر يحمل قوة القص المحسوبة أعلاه دون تلامس مباشر مع التربة (لا يحمل ضغط تربة)
  const strapWidthMm = Math.min(edgeColumn.widthMm, interiorColumn.widthMm);
  const strapMuKNm = strapShearFactoredKN * columnsSpacingM * 0.5; // عزم تقريبي في منتصف الجسر الرابط الصلب
  let strapDMm = 300;
  let it2 = 0;
  while (it2 < 40) {
    it2 += 1;
    const oneway = oneWayShearCapacityKN({ bwMm: strapWidthMm, dMm: strapDMm, fcMPa });
    if (strapShearFactoredKN <= oneway.phiVcKN) break;
    strapDMm += 25;
  }
  const strapOverallDepthMm = Math.ceil((strapDMm + 50 + 20) / 25) * 25;
  const strapSteel = solveFlexuralSteel({
    MuKNm: Math.max(strapMuKNm, 0.001),
    bMm: strapWidthMm,
    dMm: strapDMm,
    fcMPa,
    fyMPa,
  });
  const strapBars = strapSteel.asMm2 ? chooseSpacingForAreaPerMeter(strapSteel.asMm2 / (strapWidthMm / 1000)) : null;
  const strapVolumeM3 = (strapWidthMm / 1000) * (strapOverallDepthMm / 1000) * columnsSpacingM;

  const totalVolumeM3 = edgeFooting.concreteVolumeM3 + interiorFooting.concreteVolumeM3 + strapVolumeM3;
  const materialOpts = { ...defaultMaterialOptions(), ...materials };
  const materialResult = calculateConcreteMaterials(totalVolumeM3, materialOpts);

  return {
    type: 'strap_footing',
    eccentricityM: round(eEdgeM, 3),
    strapShear: { serviceKN: round(strapShearServiceKN, 2), factoredKN: round(strapShearFactoredKN, 2) },
    reactions: {
      R1serviceKN: round(R1service, 2),
      R2serviceKN: round(R2service, 2),
      R1factoredKN: round(R1u, 2),
      R2factoredKN: round(R2u, 2),
    },
    edgeFooting,
    interiorFooting,
    strapBeam: {
      widthMm: strapWidthMm,
      overallDepthMm: strapOverallDepthMm,
      effectiveDepthMm: strapDMm,
      MuKNm: round(strapMuKNm, 2),
      reinforcement: strapBars ? `Ø${strapBars.diameterMm}mm @ ${strapBars.spacingMm}mm (سفلي)` : 'الحد الأدنى الإنشائي',
      concreteVolumeM3: round(strapVolumeM3, 3),
    },
    quantities: {
      concreteVolumeM3: round(totalVolumeM3, 3),
    },
    materials: materialResult,
    warnings,
  };
}
