// lib/calc/column.js
// =============================================================================
// حاسبة الأعمدة - تصميم حقيقي على الحمل المحوري وفق ACI 318 (أعمدة قصيرة/غير رشيقة)
// φPn(max) = 0.80 φ [0.85 f'c (Ag - Ast) + fy Ast]  لأعمدة بكانات (Tied)
// φPn(max) = 0.85 φ [0.85 f'c (Ag - Ast) + fy Ast]  لأعمدة بحلزون (Spiral)
// =============================================================================

import { validateNumbers, factoredLoad, serviceLoad, barAreaMm2, chooseBarCountForArea, round } from './common.js';
import { calculateConcreteMaterials, defaultMaterialOptions } from './materials.js';

export function calculateColumn(inputs) {
  const {
    deadLoadKN,
    liveLoadKN,
    widthMm,
    depthMm,
    heightM,
    fcMPa = 25,
    fyMPa = 420,
    tieType = 'tied', // tied | spiral
    coverMm = 40,
    minSteelRatioPct = 1.0,
    maxSteelRatioPct = 8.0,
    slendernessCheck = true,
    materials = {},
  } = inputs;

  validateNumbers([
    ['الحمل الميت', deadLoadKN],
    ['الحمل الحي', liveLoadKN, { allowZero: true }],
    ['عرض العمود', widthMm],
    ['عمق العمود', depthMm],
    ['ارتفاع العمود', heightM],
    ['مقاومة الخرسانة', fcMPa],
    ['إجهاد خضوع الحديد', fyMPa],
  ]);

  const warnings = [];
  const Pservice = serviceLoad(deadLoadKN, liveLoadKN);
  const Pu = factoredLoad(deadLoadKN, liveLoadKN);

  const AgMm2 = widthMm * depthMm;
  const phi = tieType === 'spiral' ? 0.75 : 0.65;
  const alpha = tieType === 'spiral' ? 0.85 : 0.80;

  // حل مباشر لـ Ast من معادلة القدرة القصوى بافتراض أنها تساوي الحمل المصعّد Pu
  const PuN = Pu * 1000;
  let AstReqMm2 = (PuN / (alpha * phi) - 0.85 * fcMPa * AgMm2) / (fyMPa - 0.85 * fcMPa);

  const rhoMin = minSteelRatioPct / 100;
  const rhoMax = maxSteelRatioPct / 100;
  let rhoReq = AstReqMm2 / AgMm2;
  let governedByMinimum = false;
  if (rhoReq < rhoMin) {
    rhoReq = rhoMin;
    AstReqMm2 = rhoMin * AgMm2;
    governedByMinimum = true;
  }
  const isValid = rhoReq <= rhoMax;
  if (!isValid) {
    warnings.push('نسبة التسليح المطلوبة تتجاوز 8% - يلزم تكبير مقطع العمود.');
  }

  const barsSelection = chooseBarCountForArea(AstReqMm2, { minBars: tieType === 'spiral' ? 6 : 4 });
  const actualRho = barsSelection.providedAreaMm2 / AgMm2;

  // إعادة حساب القدرة الفعلية بعد اختيار الحديد الفعلي
  const phiPnActualKN =
    (alpha * phi * (0.85 * fcMPa * (AgMm2 - barsSelection.providedAreaMm2) + fyMPa * barsSelection.providedAreaMm2)) / 1000;
  const utilizationRatio = Pu / phiPnActualKN;

  // فحص النحافة المبسّط (Slenderness) - أعمدة غير مربوطة جانبياً بإطار مقاوم للانفعالات الجانبية kLu/r
  let slenderness = null;
  if (slendernessCheck) {
    const rGyrationMm = 0.3 * Math.min(widthMm, depthMm); // نصف قطر الدوران التقريبي لمقطع مستطيل = 0.3h
    const kFactor = 1.0; // افتراض مُقيّد بإطار جانبي (طرف مفصلي تقريباً) كقيمة افتراضية آمنة
    const kluOverR = (kFactor * heightM * 1000) / rGyrationMm;
    const isSlender = kluOverR > 22; // الحد الأدنى الشائع لاعتبار العمود غير رشيق في الإطارات غير المقيدة جانبياً (تبسيط عملي)
    slenderness = { kluOverR: round(kluOverR, 1), isSlender };
    if (isSlender) {
      warnings.push('نسبة النحافة kLu/r تتجاوز الحد الشائع (22) - قد يتطلب العمود تصميماً مفصّلاً لتأثيرات الرشاقة (تكبير العزم) خارج نطاق هذه الحاسبة المبسطة.');
    }
  }

  // الوصلات والكانات (Ties) وفق ACI 318 - أصغر ثلاث قيم
  const tieSpacingMm = Math.min(16 * barsSelection.diameterMm, 48 * 10, Math.min(widthMm, depthMm));
  const tieSpacingRounded = Math.floor(tieSpacingMm / 25) * 25;

  const volumeM3 = (AgMm2 / 1e6) * heightM;
  const steelWeightKg = barsSelection.count * heightM * ((Math.PI / 4) * barsSelection.diameterMm ** 2 * 7850) / 1e6;

  const materialOpts = { ...defaultMaterialOptions(), ...materials };
  const materialResult = calculateConcreteMaterials(volumeM3, materialOpts);

  return {
    type: 'column',
    loads: { PserviceKN: round(Pservice, 2), PuKN: round(Pu, 2) },
    geometry: { widthMm, depthMm, heightM, AgMm2: round(AgMm2, 0) },
    design: {
      tieType,
      phi,
      alpha,
      AstReqMm2: round(AstReqMm2, 0),
      rhoReq: round(rhoReq * 100, 3),
      governedByMinimum,
      isValid,
      barsSelection,
      actualRhoPct: round(actualRho * 100, 3),
      phiPnActualKN: round(phiPnActualKN, 1),
      utilizationRatio: round(utilizationRatio, 3),
      reinforcement: `${barsSelection.count} Ø${barsSelection.diameterMm}mm (طولي)`,
      ties: `كانات Ø10mm @ ${tieSpacingRounded}mm`,
    },
    slenderness,
    quantities: {
      concreteVolumeM3: round(volumeM3, 3),
      steelWeightKg: round(steelWeightKg, 1),
    },
    materials: materialResult,
    warnings,
  };
}
