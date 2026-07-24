// lib/calc/beam.js
// =============================================================================
// حاسبة الكمرات - تصميم انحناء وقص حقيقي وفق ACI 318، مع الوزن الذاتي المحسوب فعلياً
// من أبعاد المقطع (وليس قيمة تقريبية) وفحص سماكة الترخيم الدنيا (Deflection Control)
// =============================================================================

import {
  validateNumbers,
  solveFlexuralSteel,
  oneWayShearCapacityKN,
  designStirrups,
  chooseBarCountForArea,
  CONCRETE_UNIT_WEIGHT_KN_M3,
  round,
} from './common.js';
import { calculateConcreteMaterials, defaultMaterialOptions } from './materials.js';

const ASSUMED_MAIN_BAR_MM = 20;

function minThicknessRatio(supportType) {
  // ACI 318 Table 9.3.1.1 - لعناصر لا تحمل قواطع/تشطيبات معرضة للتضرر بالترخيم (fy = 420 MPa كأساس)
  switch (supportType) {
    case 'cantilever':
      return 8;
    case 'continuous':
      return 21; // مسند من الطرفين (منتصف بحر مستمر)
    case 'oneEndContinuous':
      return 18.5;
    default:
      return 16; // بسيط الإسناد
  }
}

export function calculateBeam(inputs) {
  const {
    spanM,
    supportType = 'simple', // simple | cantilever | continuous | oneEndContinuous
    superimposedDeadKNm = 0,
    liveLoadKNm,
    widthMm,
    heightMm,
    fcMPa = 25,
    fyMPa = 420,
    coverMm = 40,
    stirrupDiaMm = 10,
    stirrupLegs = 2,
    materials = {},
  } = inputs;

  validateNumbers([
    ['بحر الكمرة', spanM],
    ['الحمل الحي الموزع', liveLoadKNm, { allowZero: true }],
    ['عرض الكمرة', widthMm],
    ['ارتفاع الكمرة', heightMm],
    ['مقاومة الخرسانة', fcMPa],
    ['إجهاد خضوع الحديد', fyMPa],
  ]);

  const warnings = [];

  const selfWeightKNm = (widthMm / 1000) * (heightMm / 1000) * CONCRETE_UNIT_WEIGHT_KN_M3;
  const totalDeadKNm = selfWeightKNm + (superimposedDeadKNm || 0);
  const wuKNm = 1.2 * totalDeadKNm + 1.6 * (liveLoadKNm || 0);

  let MuPosKNm = 0;
  let MuNegKNm = 0;
  let VuKN = 0;
  let momentFormula = '';
  switch (supportType) {
    case 'cantilever':
      MuNegKNm = (wuKNm * spanM ** 2) / 2;
      VuKN = wuKNm * spanM;
      momentFormula = 'Mu = wu·L²/2 (عند وجه المسند - كابولي)';
      break;
    case 'continuous':
      MuPosKNm = (wuKNm * spanM ** 2) / 16;
      MuNegKNm = (wuKNm * spanM ** 2) / 10;
      VuKN = 1.15 * ((wuKNm * spanM) / 2);
      momentFormula = 'معاملات ACI 318 المبسطة لبحر داخلي مستمر: Mu+ = wuLn²/16 , Mu- = wuLn²/10';
      break;
    case 'oneEndContinuous':
      MuPosKNm = (wuKNm * spanM ** 2) / 14;
      MuNegKNm = (wuKNm * spanM ** 2) / 10;
      VuKN = 1.15 * ((wuKNm * spanM) / 2);
      momentFormula = 'معاملات ACI 318 المبسطة لبحر نهائي بطرف مستمر واحد: Mu+ = wuLn²/14 , Mu- = wuLn²/10';
      break;
    default:
      MuPosKNm = (wuKNm * spanM ** 2) / 8;
      VuKN = (wuKNm * spanM) / 2;
      momentFormula = 'Mu = wu·L²/8 (بسيط الإسناد)';
  }

  const dMm = heightMm - coverMm - stirrupDiaMm - ASSUMED_MAIN_BAR_MM / 2;
  if (dMm <= 0) {
    throw new Error('العمق الفعال أصبح سالباً - راجع سماكة الكمرة والغطاء الخرساني.');
  }

  const steelPos = MuPosKNm > 0 ? solveFlexuralSteel({ MuKNm: MuPosKNm, bMm: widthMm, dMm, fcMPa, fyMPa }) : null;
  const steelNeg = MuNegKNm > 0 ? solveFlexuralSteel({ MuKNm: MuNegKNm, bMm: widthMm, dMm, fcMPa, fyMPa }) : null;

  if ((steelPos && !steelPos.isValid) || (steelNeg && !steelNeg.isValid)) {
    warnings.push('نسبة التسليح المطلوبة تتجاوز الحد الأقصى - يلزم تكبير مقطع الكمرة أو زيادة مقاومة الخرسانة.');
  }

  const barsPos = steelPos ? chooseBarCountForArea(steelPos.asMm2, { minBars: 2, maxBars: 8 }) : null;
  const barsNeg = steelNeg ? chooseBarCountForArea(steelNeg.asMm2, { minBars: 2, maxBars: 8 }) : null;

  const shearCap = oneWayShearCapacityKN({ bwMm: widthMm, dMm, fcMPa });
  const stirrups = designStirrups({
    VuKN,
    phiVcKN: shearCap.phiVcKN,
    VcKN: shearCap.VcKN,
    bwMm: widthMm,
    dMm,
    fcMPa,
    fyMPa,
    stirrupDiaMm,
    legs: stirrupLegs,
  });
  if (stirrups.sectionTooSmall) {
    warnings.push('قوة القص كبيرة جداً بالنسبة لأبعاد المقطع - يلزم تكبير عرض أو ارتفاع الكمرة.');
  }

  const minRatio = minThicknessRatio(supportType);
  const minHeightMm = (spanM * 1000) / minRatio;
  const deflectionOk = heightMm >= minHeightMm * 0.999;
  if (!deflectionOk) {
    warnings.push(
      `سماكة الكمرة (${heightMm}mm) أقل من الحد الأدنى الموصى به لضبط الترخيم دون حساب مفصّل (${round(minHeightMm, 0)}mm وفق ACI 318 Table 9.3.1.1) - يُنصح بحساب ترخيم دقيق أو زيادة الارتفاع.`
    );
  }

  const volumeM3 = (widthMm / 1000) * (heightMm / 1000) * spanM;
  const posWeight = barsPos ? barsPos.count * spanM * ((Math.PI / 4) * barsPos.diameterMm ** 2 * 7850) / 1e6 : 0;
  const negWeight = barsNeg ? barsNeg.count * spanM * ((Math.PI / 4) * barsNeg.diameterMm ** 2 * 7850) / 1e6 * 0.5 : 0; // تسليح علوي غالباً بطول جزئي
  const stirrupPerimeterM = 2 * ((widthMm - 2 * coverMm) + (heightMm - 2 * coverMm)) / 1000 + 0.1;
  const stirrupCount = stirrups.required ? Math.ceil((spanM * 1000) / stirrups.spacingMm) + 1 : 0;
  const stirrupWeight = stirrups.required
    ? stirrupCount * stirrupPerimeterM * ((Math.PI / 4) * stirrups.stirrupDiaMm ** 2 * 7850) / 1e6
    : 0;
  const steelWeightKg = posWeight + negWeight + stirrupWeight;

  const materialOpts = { ...defaultMaterialOptions(), ...materials };
  const materialResult = calculateConcreteMaterials(volumeM3, materialOpts);

  return {
    type: 'beam',
    loads: {
      selfWeightKNm: round(selfWeightKNm, 2),
      totalDeadKNm: round(totalDeadKNm, 2),
      liveLoadKNm: round(liveLoadKNm || 0, 2),
      wuKNm: round(wuKNm, 2),
    },
    geometry: { widthMm, heightMm, spanM, effectiveDepthMm: round(dMm, 0), supportType },
    flexure: {
      momentFormula,
      MuPosKNm: round(MuPosKNm, 2),
      MuNegKNm: round(MuNegKNm, 2),
      steelPos: steelPos ? { ...steelPos, asMm2: round(steelPos.asMm2, 0) } : null,
      steelNeg: steelNeg ? { ...steelNeg, asMm2: round(steelNeg.asMm2, 0) } : null,
      reinforcementPos: barsPos ? `${barsPos.count} Ø${barsPos.diameterMm}mm (سفلي)` : '—',
      reinforcementNeg: barsNeg ? `${barsNeg.count} Ø${barsNeg.diameterMm}mm (علوي)` : '—',
    },
    shear: {
      VuKN: round(VuKN, 2),
      phiVcKN: round(shearCap.phiVcKN, 2),
      stirrups,
      reinforcementShear: stirrups.required
        ? `كانات ${stirrups.legs} فرع Ø${stirrups.stirrupDiaMm}mm @ ${stirrups.spacingMm}mm`
        : 'كانات إنشائية دنيا',
    },
    deflection: { minHeightMm: round(minHeightMm, 0), providedHeightMm: heightMm, ok: deflectionOk, ratio: minRatio },
    quantities: { concreteVolumeM3: round(volumeM3, 3), steelWeightKg: round(steelWeightKg, 1) },
    materials: materialResult,
    warnings,
  };
}
