// lib/calc/pool.js
// =============================================================================
// حاسبة المسابح - مستطيل/دائري/حر الشكل. يُصمَّم الجدار على أسوأ حالتين حقيقيتين:
// (أ) المسبح ممتلئ (ضغط مياه هيدروستاتيكي للخارج) و(ب) المسبح فارغ وتحت مستوى الأرض
// الطبيعي (ضغط تربة Rankine للداخل) - ويُؤخذ العزم الأكبر لتصميم التسليح.
// =============================================================================

import { validateNumbers, solveFlexuralSteel, WATER_UNIT_WEIGHT_KN_M3, CONCRETE_UNIT_WEIGHT_KN_M3, chooseSpacingForAreaPerMeter, round } from './common.js';
import { calculateConcreteMaterials, defaultMaterialOptions } from './materials.js';

const POOL_MIN_RATIO = 0.0025;

export function calculatePool(inputs) {
  const {
    poolShape = 'rectangular', // rectangular | circular | freeform
    lengthM,
    widthM,
    diameterM,
    surfaceAreaM2,
    perimeterM,
    shallowDepthM,
    deepDepthM,
    wallThicknessMm,
    baseThicknessMm,
    belowGrade = true,
    soilUnitWeightKNm3 = 18,
    frictionAngleDeg = 30,
    workingSpaceM = 0.6,
    excavAllowanceBelowM = 0.15,
    fcMPa = 30,
    fyMPa = 420,
    coverMm = 50,
    turnoverHours = 8,
    materials = {},
  } = inputs;

  validateNumbers([
    ['العمق الضحل', shallowDepthM],
    ['العمق العميق', deepDepthM],
    ['سماكة الجدار', wallThicknessMm],
    ['سماكة القاعدة', baseThicknessMm],
  ]);

  const warnings = [];
  const avgDepthM = (shallowDepthM + deepDepthM) / 2;
  const maxDepthM = Math.max(shallowDepthM, deepDepthM);

  let planAreaM2, perimM, excavAreaM2;
  if (poolShape === 'rectangular') {
    validateNumbers([['الطول', lengthM], ['العرض', widthM]]);
    planAreaM2 = lengthM * widthM;
    perimM = 2 * (lengthM + widthM);
    excavAreaM2 = (lengthM + 2 * workingSpaceM) * (widthM + 2 * workingSpaceM);
  } else if (poolShape === 'circular') {
    validateNumbers([['القطر', diameterM]]);
    planAreaM2 = Math.PI * (diameterM / 2) ** 2;
    perimM = Math.PI * diameterM;
    excavAreaM2 = Math.PI * (diameterM / 2 + workingSpaceM) ** 2;
  } else {
    validateNumbers([['المساحة السطحية', surfaceAreaM2], ['المحيط', perimeterM]]);
    planAreaM2 = surfaceAreaM2;
    perimM = perimeterM;
    excavAreaM2 = surfaceAreaM2 + perimeterM * workingSpaceM; // تقريب هندسي مرتبة أولى لتوسعة المحيط
    warnings.push('الشكل الحر يعتمد على المساحة والمحيط المُدخلين مباشرة؛ يُصمَّم الجدار على أساس أقصى عمق (محافظ) نظراً لعدم توفر هندسة دقيقة للشكل.');
  }

  const poolVolumeM3 = planAreaM2 * avgDepthM;
  const excavationVolumeM3 = excavAreaM2 * (avgDepthM + baseThicknessMm / 1000 + excavAllowanceBelowM);

  const barDiaMm = 14;
  const dWallMm = wallThicknessMm - coverMm - barDiaMm / 2;
  if (dWallMm <= 0) throw new Error('العمق الفعال لجدار المسبح أصبح سالباً - راجع السماكة والغطاء الخرساني.');

  const loadFactorFluid = 1.6;
  const loadFactorEarth = 1.6;
  const MuFullPoolKNm_per_m = (WATER_UNIT_WEIGHT_KN_M3 * maxDepthM ** 3) / 6 * loadFactorFluid;

  let MuEmptyPoolKNm_per_m = 0;
  let Ka = null;
  if (belowGrade) {
    const phiRad = (frictionAngleDeg * Math.PI) / 180;
    Ka = Math.tan(Math.PI / 4 - phiRad / 2) ** 2;
    MuEmptyPoolKNm_per_m = (Ka * soilUnitWeightKNm3 * maxDepthM ** 3) / 6 * loadFactorEarth;
  }

  const governingMuKNm_per_m = Math.max(MuFullPoolKNm_per_m, MuEmptyPoolKNm_per_m);
  const governingCase = MuFullPoolKNm_per_m >= MuEmptyPoolKNm_per_m ? 'المسبح ممتلئ (ضغط مياه للخارج)' : 'المسبح فارغ (ضغط تربة للداخل)';

  const steelVertical = solveFlexuralSteel({ MuKNm: governingMuKNm_per_m, bMm: 1000, dMm: dWallMm, fcMPa, fyMPa, rhoMinOverride: POOL_MIN_RATIO });
  const barsVertical = chooseSpacingForAreaPerMeter(steelVertical.asMm2, { preferredDiameters: [10, 12, 14, 16, 20] });
  if (!steelVertical.isValid) warnings.push('سماكة جدار المسبح غير كافية لتحمل عزم الحالة الحاكمة - يلزم زيادة السماكة.');

  const AsHorizMinPerM = POOL_MIN_RATIO * 1000 * wallThicknessMm;
  const barsHoriz = chooseSpacingForAreaPerMeter(AsHorizMinPerM, { preferredDiameters: [10, 12, 14] });

  const wallVolumeM3 = perimM * avgDepthM * (wallThicknessMm / 1000);
  // سماكة القاعدة تتبع الميل (تصحيح بسيط لطول القاعدة الفعلي عند اختلاف العمق بين الطرفين)
  const slopeAngleRad = poolShape === 'rectangular' && lengthM ? Math.atan(Math.abs(deepDepthM - shallowDepthM) / lengthM) : 0;
  const baseVolumeM3 = (planAreaM2 * (baseThicknessMm / 1000)) / Math.cos(slopeAngleRad);

  const totalConcreteM3 = wallVolumeM3 + baseVolumeM3;

  // فحص الرفع (Uplift/Buoyancy) عند افتراض منسوب مياه جوفية حتى سطح الأرض (محافظ) للمسبح الفارغ تحت مستوى الأرض
  let upliftCheck = null;
  if (belowGrade) {
    const upliftForceKN = WATER_UNIT_WEIGHT_KN_M3 * (avgDepthM + baseThicknessMm / 1000) * planAreaM2;
    const structureWeightKN = totalConcreteM3 * CONCRETE_UNIT_WEIGHT_KN_M3;
    const upliftSafe = structureWeightKN >= upliftForceKN;
    upliftCheck = { upliftForceKN: round(upliftForceKN, 1), structureWeightKN: round(structureWeightKN, 1), safe: upliftSafe };
    if (!upliftSafe) {
      warnings.push('وزن منشأ المسبح الفارغ أقل من قوة الرفع الافتراضية لمنسوب مياه جوفية عند سطح الأرض - يلزم تصريف تحت القاعدة (Hydrostatic Relief Valve) أو تثقيل إضافي أو تحقق فعلي من منسوب المياه الجوفية.');
    }
  }

  const waterproofingAreaM2 = round(perimM * avgDepthM + planAreaM2, 2);
  const tilingAreaM2 = waterproofingAreaM2;
  const plasteringAreaM2 = waterproofingAreaM2;

  const flowRateM3PerHr = poolVolumeM3 / turnoverHours;
  const pump = {
    turnoverHours,
    poolVolumeM3: round(poolVolumeM3, 2),
    requiredFlowRateM3PerHr: round(flowRateM3PerHr, 2),
    requiredFlowRateLPM: round((flowRateM3PerHr * 1000) / 60, 1),
    requiredFlowRateGPM: round(flowRateM3PerHr * 4.403, 1),
    note: 'يمثل معدل التدفق المطلوب لدورة تنقية كاملة خلال المدة المحددة - يُختار المضخة والفلتر من كتالوج المُصنّع بما يحقق هذا التدفق أو أعلى.',
  };

  const materialOpts = { ...defaultMaterialOptions(), grade: materials.grade || 'C30', ...materials };
  const materialResult = calculateConcreteMaterials(totalConcreteM3, materialOpts);

  return {
    type: 'pool',
    poolShape,
    belowGrade,
    geometry: { shallowDepthM, deepDepthM, avgDepthM: round(avgDepthM, 2), maxDepthM, planAreaM2: round(planAreaM2, 2), perimeterM: round(perimM, 2) },
    excavation: { excavAreaM2: round(excavAreaM2, 2), excavationVolumeM3: round(excavationVolumeM3, 2), workingSpaceM },
    wallDesign: {
      governingCase,
      MuFullPoolKNm_per_m: round(MuFullPoolKNm_per_m, 2),
      MuEmptyPoolKNm_per_m: round(MuEmptyPoolKNm_per_m, 2),
      Ka: Ka != null ? round(Ka, 3) : null,
      reinforcementVertical: `Ø${barsVertical.diameterMm}mm @ ${barsVertical.spacingMm}mm (رأسي - كلا الوجهين لمقاومة انعكاس الحمل)`,
      reinforcementHorizontal: `Ø${barsHoriz.diameterMm}mm @ ${barsHoriz.spacingMm}mm (أفقي)`,
    },
    upliftCheck,
    finishes: { waterproofingAreaM2, tilingAreaM2, plasteringAreaM2 },
    pump,
    quantities: {
      concreteVolumeM3: round(totalConcreteM3, 3),
      wallVolumeM3: round(wallVolumeM3, 3),
      baseVolumeM3: round(baseVolumeM3, 3),
      poolWaterCapacityM3: round(poolVolumeM3, 2),
    },
    materials: materialResult,
    warnings,
  };
}
