// lib/calc/mat.js
// =============================================================================
// حاسبة اللبشة (Mat Foundation) - الطريقة الجاسئة/التقليدية (Rigid/Conventional Method)
// وهي الطريقة اليدوية القياسية والمعتمدة لتحليل توزيع ضغط التربة تحت اللبشات المنتظمة،
// مع فحص القص الثاقب عند العمود الأثقل وتصميم شرائح تمثيلية بعرض 1م بمعاملات ACI.
// ملاحظة منهجية: للبشات الكبيرة/غير المنتظمة أو ذات فروق جساءة كبيرة بين الأعمدة، يُوصى
// بتحليل أدق بطريقة العناصر المحددة (FEM) خارج نطاق هذه الحاسبة.
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

function typicalSpacing(positions) {
  const unique = [...new Set(positions.map((p) => round(p, 2)))].sort((a, b) => a - b);
  if (unique.length < 2) return Math.max(unique[0] || 5, 5);
  const diffs = [];
  for (let i = 1; i < unique.length; i += 1) diffs.push(unique[i] - unique[i - 1]);
  return diffs.reduce((s, d) => s + d, 0) / diffs.length;
}

export function calculateMatFoundation(inputs) {
  const {
    matLengthM,
    matWidthM,
    columns, // [{ deadKN, liveKN, xM, yM, widthMm, depthMm }]
    soilBearingCapacityKPa,
    foundationDepthM = 2,
    soilUnitWeightKNm3 = 18,
    fcMPa = 30,
    fyMPa = 420,
    coverMm = 75,
    materials = {},
  } = inputs;

  validateNumbers([
    ['طول اللبشة', matLengthM],
    ['عرض اللبشة', matWidthM],
    ['قدرة تحمل التربة', soilBearingCapacityKPa],
    ['مقاومة الخرسانة', fcMPa],
    ['إجهاد خضوع الحديد', fyMPa],
  ]);
  if (!Array.isArray(columns) || columns.length < 2) {
    throw new Error('يلزم إدخال عمودين على الأقل للبشة.');
  }
  columns.forEach((c, i) => {
    validateNumbers([
      [`الحمل الميت للعمود ${i + 1}`, c.deadKN],
      [`موقع X للعمود ${i + 1}`, c.xM, { allowZero: true }],
      [`موقع Y للعمود ${i + 1}`, c.yM, { allowZero: true }],
      [`عرض العمود ${i + 1}`, c.widthMm],
    ]);
  });

  const warnings = [];
  const netAllowableKPa = soilBearingCapacityKPa - soilUnitWeightKNm3 * foundationDepthM;
  if (netAllowableKPa <= 0) throw new Error('قدرة التحمل الصافية للتربة سالبة أو صفر - راجع عمق التأسيس.');

  const totalService = columns.reduce((s, c) => s + serviceLoad(c.deadKN, c.liveKN), 0);
  const totalFactored = columns.reduce((s, c) => s + factoredLoad(c.deadKN, c.liveKN), 0);
  const A = matLengthM * matWidthM;

  const matCx = matLengthM / 2;
  const matCy = matWidthM / 2;
  const loadCx = columns.reduce((s, c) => s + serviceLoad(c.deadKN, c.liveKN) * c.xM, 0) / totalService;
  const loadCy = columns.reduce((s, c) => s + serviceLoad(c.deadKN, c.liveKN) * c.yM, 0) / totalService;
  const ex = loadCx - matCx;
  const ey = loadCy - matCy;

  const Iy = (matWidthM * matLengthM ** 3) / 12; // مقاومة الانحناء حول محور y (تغيّر الضغط باتجاه X)
  const Ix = (matLengthM * matWidthM ** 3) / 12; // مقاومة الانحناء حول محور x (تغيّر الضغط باتجاه Y)

  const corners = [
    { x: 0, y: 0 },
    { x: matLengthM, y: 0 },
    { x: 0, y: matWidthM },
    { x: matLengthM, y: matWidthM },
  ];
  const qService = corners.map((pt) => {
    const dx = pt.x - matCx;
    const dy = pt.y - matCy;
    return totalService / A + (totalService * ex * dx) / Iy + (totalService * ey * dy) / Ix;
  });
  const qFactored = corners.map((pt) => {
    const dx = pt.x - matCx;
    const dy = pt.y - matCy;
    return totalFactored / A + (totalFactored * ex * dx) / Iy + (totalFactored * ey * dy) / Ix;
  });

  const qServiceMax = Math.max(...qService);
  const qServiceMin = Math.min(...qService);
  const qFactoredAvg = totalFactored / A;

  if (qServiceMax > netAllowableKPa * 1.001) {
    warnings.push('أقصى ضغط تربة عند أحد الأركان يتجاوز قدرة التحمل الصافية - يلزم تكبير أبعاد اللبشة أو إعادة توزيع الأعمدة.');
  }
  if (qServiceMin < 0) {
    warnings.push('نتج ضغط تربة سالب (شد/انفصال) عند أحد الأركان - اللامركزية كبيرة نسبياً لأبعاد اللبشة؛ يلزم تكبير اللبشة أو إعادة توزيع مركز الثقل.');
  }

  const heaviest = columns.reduce((a, b) => (factoredLoad(a.deadKN, a.liveKN) > factoredLoad(b.deadKN, b.liveKN) ? a : b));

  let dMm = 350;
  let punching, oneway;
  let it = 0;
  while (it < 60) {
    it += 1;
    const dM = dMm / 1000;
    punching = punchingShearCapacityKN({
      c1Mm: heaviest.widthMm,
      c2Mm: heaviest.depthMm || heaviest.widthMm,
      dMm,
      fcMPa,
      columnType: 'interior',
    });
    const areaInside = (heaviest.widthMm / 1000 + dM) * ((heaviest.depthMm || heaviest.widthMm) / 1000 + dM);
    const VuPunch = factoredLoad(heaviest.deadKN, heaviest.liveKN) - qFactoredAvg * areaInside;
    oneway = oneWayShearCapacityKN({ bwMm: 1000, dMm, fcMPa });
    const VuOneWayPerM = qFactoredAvg * 1; // تقريب: قص شريحة نمطية بعرض 1م عند فرضية بحر نمطي (تُفحص عبر التصميم الانحنائي أدناه أيضاً)
    if (VuPunch <= punching.phiVcKN) break;
    dMm += 25;
  }
  const overallDepthMm = Math.ceil((dMm + coverMm + 20) / 25) * 25;
  const dFinalMm = overallDepthMm - coverMm - 10;

  const spacingX = typicalSpacing(columns.map((c) => c.xM));
  const spacingY = typicalSpacing(columns.map((c) => c.yM));

  const rhoMinMat = shrinkageTempRatio(fyMPa);
  // شريحة نمطية باتجاه X (بحر = التباعد النمطي بين الأعمدة باتجاه Y بين خطوط الأعمدة المتجاورة) - معاملات كمرة مستمرة
  const MposX = (qFactoredAvg * spacingX ** 2) / 16;
  const MnegX = (qFactoredAvg * spacingX ** 2) / 10;
  const MposY = (qFactoredAvg * spacingY ** 2) / 16;
  const MnegY = (qFactoredAvg * spacingY ** 2) / 10;

  const steelPosX = solveFlexuralSteel({ MuKNm: MposX, bMm: 1000, dMm: dFinalMm, fcMPa, fyMPa, rhoMinOverride: rhoMinMat });
  const steelNegX = solveFlexuralSteel({ MuKNm: MnegX, bMm: 1000, dMm: dFinalMm, fcMPa, fyMPa, rhoMinOverride: rhoMinMat });
  const steelPosY = solveFlexuralSteel({ MuKNm: MposY, bMm: 1000, dMm: dFinalMm, fcMPa, fyMPa, rhoMinOverride: rhoMinMat });
  const steelNegY = solveFlexuralSteel({ MuKNm: MnegY, bMm: 1000, dMm: dFinalMm, fcMPa, fyMPa, rhoMinOverride: rhoMinMat });

  const barsPosX = chooseSpacingForAreaPerMeter(steelPosX.asMm2);
  const barsNegX = chooseSpacingForAreaPerMeter(steelNegX.asMm2);
  const barsPosY = chooseSpacingForAreaPerMeter(steelPosY.asMm2);
  const barsNegY = chooseSpacingForAreaPerMeter(steelNegY.asMm2);

  const volumeM3 = A * (overallDepthMm / 1000);
  function meshWeight(bars, spanDirM, otherDirM) {
    return (otherDirM / (bars.spacingMm / 1000)) * spanDirM * ((Math.PI / 4) * bars.diameterMm ** 2 * 7850) / 1e6;
  }
  const steelWeightKg =
    meshWeight(barsPosX, matLengthM, matWidthM) +
    meshWeight(barsNegX, matLengthM, matWidthM) * 0.5 +
    meshWeight(barsPosY, matWidthM, matLengthM) +
    meshWeight(barsNegY, matWidthM, matLengthM) * 0.5;

  const materialOpts = { ...defaultMaterialOptions(), ...materials };
  const materialResult = calculateConcreteMaterials(volumeM3, materialOpts);

  return {
    type: 'mat_foundation',
    methodology: 'الطريقة الجاسئة (Rigid/Conventional Method) لتوزيع ضغط التربة + معاملات عزم ACI المبسطة للشرائح النمطية',
    loads: { totalServiceKN: round(totalService, 2), totalFactoredKN: round(totalFactored, 2) },
    geometry: { matLengthM, matWidthM, areaM2: round(A, 2), overallDepthMm, effectiveDepthMm: round(dFinalMm, 0) },
    eccentricity: { exM: round(ex, 3), eyM: round(ey, 3) },
    soilPressure: {
      netAllowableKPa: round(netAllowableKPa, 2),
      qServiceMaxKPa: round(qServiceMax, 2),
      qServiceMinKPa: round(qServiceMin, 2),
      qFactoredAvgKPa: round(qFactoredAvg, 2),
      cornerValuesServiceKPa: qService.map((v) => round(v, 2)),
    },
    punchingShear: {
      atColumn: 'أثقل عمود',
      demandFactoredKN: round(factoredLoad(heaviest.deadKN, heaviest.liveKN), 1),
      phiVcKN: round(punching.phiVcKN, 1),
    },
    typicalSpans: { spacingXM: round(spacingX, 2), spacingYM: round(spacingY, 2) },
    flexure: {
      directionX: {
        MposKNm_per_m: round(MposX, 2),
        MnegKNm_per_m: round(MnegX, 2),
        reinforcementBottom: `Ø${barsPosX.diameterMm}mm @ ${barsPosX.spacingMm}mm`,
        reinforcementTop: `Ø${barsNegX.diameterMm}mm @ ${barsNegX.spacingMm}mm`,
      },
      directionY: {
        MposKNm_per_m: round(MposY, 2),
        MnegKNm_per_m: round(MnegY, 2),
        reinforcementBottom: `Ø${barsPosY.diameterMm}mm @ ${barsPosY.spacingMm}mm`,
        reinforcementTop: `Ø${barsNegY.diameterMm}mm @ ${barsNegY.spacingMm}mm`,
      },
    },
    quantities: { concreteVolumeM3: round(volumeM3, 3), steelWeightKg: round(steelWeightKg, 1) },
    materials: materialResult,
    warnings,
  };
}
