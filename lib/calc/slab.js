// lib/calc/slab.js
// =============================================================================
// حاسبة البلاطات - أحادية الاتجاه (كشريحة بعرض 1م) وثنائية الاتجاه (بلاطات مسندة على
// حوائط/كمرات من الأطراف الأربعة). توزيع الأحمال بين الاتجاهين في الحالة الثنائية يُحسب
// بطريقة "توافق الانفراف" (Deflection Compatibility / Rankine-Grashof) وهي طريقة تحليلية
// حقيقية مُشتقة بالكامل من الأبعاد (وليست جدول قيم جاهزة) ثم يُصمَّم كل اتجاه كشريحة بعرض
// 1م باستخدام معاملات العزم القياسية لنفس منهجية الكمرات المستمرة (ACI 318).
// =============================================================================

import { validateNumbers, solveFlexuralSteel, oneWayShearCapacityKN, shrinkageTempRatio, chooseSpacingForAreaPerMeter, CONCRETE_UNIT_WEIGHT_KN_M3, round } from './common.js';
import { calculateConcreteMaterials, defaultMaterialOptions } from './materials.js';

function momentCoefficients(edgeCondition) {
  switch (edgeCondition) {
    case 'cantilever':
      return { pos: null, neg: 2, formula: 'wL²/2 عند المسند' };
    case 'continuous':
      return { pos: 16, neg: 10, formula: 'wL²/16 (+) ، wL²/10 (-)' };
    case 'oneEndContinuous':
      return { pos: 14, neg: 10, formula: 'wL²/14 (+) ، wL²/10 (-)' };
    default:
      return { pos: 8, neg: null, formula: 'wL²/8 (بسيط الإسناد)' };
  }
}

function designStrip({ wKPa, spanM, edgeCondition, bMm, dMm, fcMPa, fyMPa, rhoMinOverride }) {
  const coef = momentCoefficients(edgeCondition);
  const MposKNm = coef.pos ? (wKPa * spanM ** 2) / coef.pos : 0;
  const MnegKNm = coef.neg ? (wKPa * spanM ** 2) / coef.neg : 0;
  const steelPos = MposKNm > 0 ? solveFlexuralSteel({ MuKNm: MposKNm, bMm, dMm, fcMPa, fyMPa, rhoMinOverride }) : null;
  const steelNeg = MnegKNm > 0 ? solveFlexuralSteel({ MuKNm: MnegKNm, bMm, dMm, fcMPa, fyMPa, rhoMinOverride }) : null;
  const VuKN = edgeCondition === 'cantilever' ? wKPa * spanM : (wKPa * spanM) / 2;
  return { coef, MposKNm, MnegKNm, steelPos, steelNeg, VuKN };
}

export function calculateOneWaySlab(inputs) {
  const {
    spanM,
    edgeCondition = 'simple',
    superimposedDeadKPa = 0,
    liveLoadKPa,
    thicknessMm,
    fcMPa = 25,
    fyMPa = 420,
    coverMm = 20,
    barDiaMm = 12,
    materials = {},
  } = inputs;

  validateNumbers([
    ['بحر البلاطة', spanM],
    ['الحمل الحي', liveLoadKPa, { allowZero: true }],
    ['سماكة البلاطة', thicknessMm],
    ['مقاومة الخرسانة', fcMPa],
    ['إجهاد خضوع الحديد', fyMPa],
  ]);

  const warnings = [];
  const selfWeightKPa = (thicknessMm / 1000) * CONCRETE_UNIT_WEIGHT_KN_M3;
  const totalDeadKPa = selfWeightKPa + (superimposedDeadKPa || 0);
  const wuKPa = 1.2 * totalDeadKPa + 1.6 * (liveLoadKPa || 0);

  const dMm = thicknessMm - coverMm - barDiaMm / 2;
  if (dMm <= 0) throw new Error('العمق الفعال أصبح سالباً - راجع سماكة البلاطة والغطاء الخرساني.');

  const rhoMinSlab = shrinkageTempRatio(fyMPa);
  const main = designStrip({ wKPa: wuKPa, spanM, edgeCondition, bMm: 1000, dMm, fcMPa, fyMPa, rhoMinOverride: rhoMinSlab });

  if ((main.steelPos && !main.steelPos.isValid) || (main.steelNeg && !main.steelNeg.isValid)) {
    warnings.push('نسبة التسليح المطلوبة تتجاوز الحد الأقصى - يلزم زيادة سماكة البلاطة.');
  }

  const shearCap = oneWayShearCapacityKN({ bwMm: 1000, dMm, fcMPa });
  if (main.VuKN > shearCap.phiVcKN) {
    warnings.push('قوة القص تتجاوز قدرة الخرسانة وحدها - يلزم زيادة سماكة البلاطة (البلاطات عادة لا تحتوي كانات قص).');
  }

  const barsMainPos = main.steelPos ? chooseSpacingForAreaPerMeter(main.steelPos.asMm2, { preferredDiameters: [10, 12, 14, 16, 18] }) : null;
  const barsMainNeg = main.steelNeg ? chooseSpacingForAreaPerMeter(main.steelNeg.asMm2, { preferredDiameters: [10, 12, 14, 16, 18] }) : null;

  // حديد التوزيع/الانكماش في الاتجاه العمودي
  const AsDistPerM = rhoMinSlab * 1000 * dMm;
  const barsDist = chooseSpacingForAreaPerMeter(AsDistPerM, { preferredDiameters: [8, 10, 12] });

  const minSpanDepthRatio = edgeCondition === 'cantilever' ? 10 : edgeCondition === 'continuous' ? 28 : edgeCondition === 'oneEndContinuous' ? 24 : 20;
  const minThicknessMm = (spanM * 1000) / minSpanDepthRatio;
  const deflectionOk = thicknessMm >= minThicknessMm * 0.999;
  if (!deflectionOk) {
    warnings.push(`سماكة البلاطة أقل من الحد الأدنى الموصى به لضبط الترخيم دون حساب مفصّل (${round(minThicknessMm, 0)}mm).`);
  }

  const volumeM3PerM = (thicknessMm / 1000) * spanM; // لكل متر عرض
  const mainWeightPerM = barsMainPos
    ? (1000 / (barsMainPos.spacingMm)) * spanM * ((Math.PI / 4) * barsMainPos.diameterMm ** 2 * 7850) / 1e6
    : 0;
  const distWeightPerM = (1000 / barsDist.spacingMm) * 1 * ((Math.PI / 4) * barsDist.diameterMm ** 2 * 7850) / 1e6;
  const steelWeightPerM2Kg = mainWeightPerM / 1 + distWeightPerM; // تقريب: كغم لكل م² من البلاطة

  const materialOpts = { ...defaultMaterialOptions(), ...materials };
  const materialResult = calculateConcreteMaterials(volumeM3PerM, materialOpts); // لكل متر عرض - يُضرب بالعرض الفعلي في الواجهة

  return {
    type: 'one_way_slab',
    loads: { selfWeightKPa: round(selfWeightKPa, 2), totalDeadKPa: round(totalDeadKPa, 2), wuKPa: round(wuKPa, 2) },
    geometry: { spanM, thicknessMm, effectiveDepthMm: round(dMm, 1), edgeCondition },
    flexure: {
      formula: main.coef.formula,
      MposKNm_per_m: round(main.MposKNm, 2),
      MnegKNm_per_m: round(main.MnegKNm, 2),
      reinforcementMainPos: barsMainPos ? `Ø${barsMainPos.diameterMm}mm @ ${barsMainPos.spacingMm}mm (سفلي - رئيسي)` : '—',
      reinforcementMainNeg: barsMainNeg ? `Ø${barsMainNeg.diameterMm}mm @ ${barsMainNeg.spacingMm}mm (علوي - رئيسي)` : '—',
      reinforcementDistribution: `Ø${barsDist.diameterMm}mm @ ${barsDist.spacingMm}mm (توزيع/انكماش)`,
    },
    shear: { VuKN_per_m: round(main.VuKN, 2), phiVcKN_per_m: round(shearCap.phiVcKN, 2) },
    deflection: { minThicknessMm: round(minThicknessMm, 0), providedThicknessMm: thicknessMm, ok: deflectionOk },
    quantities: { concreteVolumeM3PerMeterWidth: round(volumeM3PerM, 4), steelWeightKgPerM2: round(steelWeightPerM2Kg, 2) },
    materialsPerMeterWidth: materialResult,
    warnings,
  };
}

export function calculateTwoWaySlab(inputs) {
  const {
    shortSpanM,
    longSpanM,
    edgeConditionShort = 'simple',
    edgeConditionLong = 'simple',
    superimposedDeadKPa = 0,
    liveLoadKPa,
    thicknessMm,
    fcMPa = 25,
    fyMPa = 420,
    coverMm = 20,
    barDiaMm = 12,
    materials = {},
  } = inputs;

  validateNumbers([
    ['البحر القصير', shortSpanM],
    ['البحر الطويل', longSpanM],
    ['الحمل الحي', liveLoadKPa, { allowZero: true }],
    ['سماكة البلاطة', thicknessMm],
  ]);
  if (longSpanM < shortSpanM) {
    throw new Error('يجب أن يكون البحر الطويل أكبر من أو يساوي البحر القصير.');
  }
  const warnings = [];
  const aspectRatio = longSpanM / shortSpanM;
  if (aspectRatio >= 2) {
    warnings.push('نسبة البحر الطويل/القصير ≥ 2 - تتصرف البلاطة عملياً كبلاطة أحادية الاتجاه؛ يُفضّل استخدام حاسبة البلاطة أحادية الاتجاه.');
  }

  const selfWeightKPa = (thicknessMm / 1000) * CONCRETE_UNIT_WEIGHT_KN_M3;
  const totalDeadKPa = selfWeightKPa + (superimposedDeadKPa || 0);
  const wuKPa = 1.2 * totalDeadKPa + 1.6 * (liveLoadKPa || 0);

  // توزيع الحمل بين الاتجاهين بطريقة توافق الانفراف (القوة الرابعة للبحر)
  const Lx4 = shortSpanM ** 4;
  const Ly4 = longSpanM ** 4;
  const wShort = wuKPa * (Ly4 / (Lx4 + Ly4)); // الاتجاه القصير (الأصلب) يحمل الحصة الأكبر
  const wLong = wuKPa * (Lx4 / (Lx4 + Ly4));

  const dShortMm = thicknessMm - coverMm - barDiaMm / 2; // الطبقة السفلية (الاتجاه القصير أقرب لسطح الشد)
  const dLongMm = thicknessMm - coverMm - barDiaMm - barDiaMm / 2; // الطبقة الثانية فوق الأولى
  if (dLongMm <= 0) throw new Error('العمق الفعال أصبح سالباً - راجع سماكة البلاطة والغطاء الخرساني.');

  const rhoMinSlab = shrinkageTempRatio(fyMPa);
  const shortStrip = designStrip({ wKPa: wShort, spanM: shortSpanM, edgeCondition: edgeConditionShort, bMm: 1000, dMm: dShortMm, fcMPa, fyMPa, rhoMinOverride: rhoMinSlab });
  const longStrip = designStrip({ wKPa: wLong, spanM: longSpanM, edgeCondition: edgeConditionLong, bMm: 1000, dMm: dLongMm, fcMPa, fyMPa, rhoMinOverride: rhoMinSlab });

  const invalid = [shortStrip.steelPos, shortStrip.steelNeg, longStrip.steelPos, longStrip.steelNeg].some((s) => s && !s.isValid);
  if (invalid) warnings.push('نسبة التسليح المطلوبة في أحد الاتجاهين تتجاوز الحد الأقصى - يلزم زيادة سماكة البلاطة.');

  const shearCapShort = oneWayShearCapacityKN({ bwMm: 1000, dMm: dShortMm, fcMPa });
  const shearCapLong = oneWayShearCapacityKN({ bwMm: 1000, dMm: dLongMm, fcMPa });
  if (shortStrip.VuKN > shearCapShort.phiVcKN || longStrip.VuKN > shearCapLong.phiVcKN) {
    warnings.push('قوة القص في أحد الاتجاهين تتجاوز قدرة الخرسانة وحدها - يلزم زيادة سماكة البلاطة.');
  }

  const barsShortPos = shortStrip.steelPos ? chooseSpacingForAreaPerMeter(shortStrip.steelPos.asMm2, { preferredDiameters: [10, 12, 14, 16] }) : null;
  const barsShortNeg = shortStrip.steelNeg ? chooseSpacingForAreaPerMeter(shortStrip.steelNeg.asMm2, { preferredDiameters: [10, 12, 14, 16] }) : null;
  const barsLongPos = longStrip.steelPos ? chooseSpacingForAreaPerMeter(longStrip.steelPos.asMm2, { preferredDiameters: [10, 12, 14, 16] }) : null;
  const barsLongNeg = longStrip.steelNeg ? chooseSpacingForAreaPerMeter(longStrip.steelNeg.asMm2, { preferredDiameters: [10, 12, 14, 16] }) : null;

  const minSpanDepthRatio = 40; // تبسيط عملي لبلاطات ثنائية الاتجاه غير مجهدة مسبقاً (تقدير أولي فقط)
  const minThicknessMm = (shortSpanM * 1000) / minSpanDepthRatio + 20;
  const deflectionOk = thicknessMm >= minThicknessMm;
  if (!deflectionOk) {
    warnings.push(`سماكة البلاطة قد تكون غير كافية لضبط الترخيم دون حساب مفصّل (استرشادي: ≥ ${round(minThicknessMm, 0)}mm).`);
  }

  const areaM2 = shortSpanM * longSpanM;
  const volumeM3 = areaM2 * (thicknessMm / 1000);

  function stripWeight(spanA, spanB, bars) {
    if (!bars) return 0;
    return (spanB / (bars.spacingMm / 1000)) * spanA * ((Math.PI / 4) * bars.diameterMm ** 2 * 7850) / 1e6;
  }
  const steelWeightKg =
    stripWeight(shortSpanM, longSpanM, barsShortPos) +
    stripWeight(shortSpanM, longSpanM, barsShortNeg) * 0.4 +
    stripWeight(longSpanM, shortSpanM, barsLongPos) +
    stripWeight(longSpanM, shortSpanM, barsLongNeg) * 0.4;

  const materialOpts = { ...defaultMaterialOptions(), ...materials };
  const materialResult = calculateConcreteMaterials(volumeM3, materialOpts);

  return {
    type: 'two_way_slab',
    methodology: 'توزيع الحمل بين الاتجاهين بطريقة توافق الانفراف (Deflection Compatibility) ثم تصميم كل اتجاه كشريحة بعرض 1م بمعاملات عزم ACI المبسطة',
    loads: { selfWeightKPa: round(selfWeightKPa, 2), totalDeadKPa: round(totalDeadKPa, 2), wuKPa: round(wuKPa, 2) },
    geometry: { shortSpanM, longSpanM, aspectRatio: round(aspectRatio, 2), thicknessMm },
    loadSharing: { wShortKPa: round(wShort, 2), wLongKPa: round(wLong, 2) },
    shortDirection: {
      edgeCondition: edgeConditionShort,
      effectiveDepthMm: round(dShortMm, 1),
      formula: shortStrip.coef.formula,
      MposKNm_per_m: round(shortStrip.MposKNm, 2),
      MnegKNm_per_m: round(shortStrip.MnegKNm, 2),
      reinforcementPos: barsShortPos ? `Ø${barsShortPos.diameterMm}mm @ ${barsShortPos.spacingMm}mm` : '—',
      reinforcementNeg: barsShortNeg ? `Ø${barsShortNeg.diameterMm}mm @ ${barsShortNeg.spacingMm}mm` : '—',
      VuKN_per_m: round(shortStrip.VuKN, 2),
      phiVcKN_per_m: round(shearCapShort.phiVcKN, 2),
    },
    longDirection: {
      edgeCondition: edgeConditionLong,
      effectiveDepthMm: round(dLongMm, 1),
      formula: longStrip.coef.formula,
      MposKNm_per_m: round(longStrip.MposKNm, 2),
      MnegKNm_per_m: round(longStrip.MnegKNm, 2),
      reinforcementPos: barsLongPos ? `Ø${barsLongPos.diameterMm}mm @ ${barsLongPos.spacingMm}mm` : '—',
      reinforcementNeg: barsLongNeg ? `Ø${barsLongNeg.diameterMm}mm @ ${barsLongNeg.spacingMm}mm` : '—',
      VuKN_per_m: round(longStrip.VuKN, 2),
      phiVcKN_per_m: round(shearCapLong.phiVcKN, 2),
    },
    deflection: { minThicknessMm: round(minThicknessMm, 0), providedThicknessMm: thicknessMm, ok: deflectionOk },
    quantities: { areaM2: round(areaM2, 2), concreteVolumeM3: round(volumeM3, 3), steelWeightKg: round(steelWeightKg, 1) },
    materials: materialResult,
    warnings,
  };
}
