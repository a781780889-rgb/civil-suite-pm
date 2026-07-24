// lib/calc/tank.js
// =============================================================================
// حاسبة الخزانات - مستطيلة (جدار كابولي تحت ضغط هيدروستاتيكي حقيقي متزايد خطياً) ودائرية
// (نظرية شد الطوق Hoop Tension: T = γw·h·R)، أرضية أو علوية.
// منهجية مبسّطة ومحافِظة (كابولي حر غير مقيّد بالقاعدة) - للخزانات الكبيرة يُوصى بتحليل
// القشريات المقيّدة (Shell Analysis / PCA Tables) لتحسين كمية التسليح.
// =============================================================================

import { validateNumbers, solveFlexuralSteel, shrinkageTempRatio, chooseSpacingForAreaPerMeter, WATER_UNIT_WEIGHT_KN_M3, round } from './common.js';
import { calculateConcreteMaterials, defaultMaterialOptions } from './materials.js';
import { calculateTwoWaySlab } from './slab.js';

const WATER_RETAINING_MIN_RATIO = 0.003; // نسبة تسليح دنيا أعلى من المعتاد للعناصر الحاوية للمياه (ضبط تشقق/منع تسرب)

export function calculateTank(inputs) {
  const {
    tankShape = 'rectangular', // rectangular | circular
    tankPosition = 'ground', // ground | elevated
    internalLengthM,
    internalWidthM,
    internalDiameterM,
    waterHeightM,
    freeboardM = 0.3,
    wallThicknessMm,
    baseThicknessMm,
    hasRoof = true,
    roofThicknessMm = null,
    fcMPa = 30,
    fyMPa = 420,
    coverMm = 50,
    loadFactorFluid = 1.6,
    externalExposed = true,
    materials = {},
  } = inputs;

  validateNumbers([
    ['ارتفاع المياه التصميمي', waterHeightM],
    ['سماكة الجدار', wallThicknessMm],
    ['سماكة القاعدة', baseThicknessMm],
  ]);

  const warnings = [];
  const totalHeightM = waterHeightM + freeboardM;
  const barDiaMm = 14;
  const dWallMm = wallThicknessMm - coverMm - barDiaMm / 2;
  if (dWallMm <= 0) throw new Error('العمق الفعال لجدار الخزان أصبح سالباً - راجع السماكة والغطاء الخرساني.');

  let shapeResult;
  if (tankShape === 'circular') {
    validateNumbers([['القطر الداخلي', internalDiameterM]]);
    const R = internalDiameterM / 2;

    const TmaxKN_per_m = WATER_UNIT_WEIGHT_KN_M3 * waterHeightM * R * loadFactorFluid;
    const phiTension = 0.9;
    const AsHoopPerM = (TmaxKN_per_m * 1000) / (phiTension * fyMPa);
    const rhoMinWall = WATER_RETAINING_MIN_RATIO;
    const AsHoopMinPerM = rhoMinWall * 1000 * wallThicknessMm;
    const AsHoopFinalPerM = Math.max(AsHoopPerM, AsHoopMinPerM);
    const barsHoop = chooseSpacingForAreaPerMeter(AsHoopFinalPerM, { preferredDiameters: [10, 12, 14, 16, 20] });

    // تسليح رأسي عند القاعدة (عزم انحناء ناتج عن تقييد اتصال الجدار بالقاعدة - بنفس أسلوب الكابولي الحر كتبسيط محافظ)
    const MuBaseKNm_per_m = (WATER_UNIT_WEIGHT_KN_M3 * waterHeightM ** 3) / 6 * loadFactorFluid;
    const steelVertical = solveFlexuralSteel({ MuKNm: MuBaseKNm_per_m, bMm: 1000, dMm: dWallMm, fcMPa, fyMPa, rhoMinOverride: rhoMinWall });
    const barsVertical = chooseSpacingForAreaPerMeter(steelVertical.asMm2, { preferredDiameters: [10, 12, 14, 16] });

    const wallVolumeM3 = Math.PI * ((R + wallThicknessMm / 1000) ** 2 - R ** 2) * totalHeightM;
    const baseOuterR = R + wallThicknessMm / 1000;
    const baseVolumeM3 = Math.PI * baseOuterR ** 2 * (baseThicknessMm / 1000);

    let roof = null;
    if (hasRoof) {
      const roofT = roofThicknessMm || Math.max(150, Math.ceil((R * 2 * 1000) / 30 / 10) * 10);
      const dRoofMm = roofT - coverMm - barDiaMm / 2;
      const selfWeightKPa = (roofT / 1000) * 25;
      const liveLoadKPa = 1.5; // حمل صيانة/وصول لسطح الخزان
      const wuKPa = 1.2 * selfWeightKPa + 1.6 * liveLoadKPa;
      const nu = 0.2; // معامل بواسون للخرسانة
      const MedgeKNm_per_m = (wuKPa * baseOuterR ** 2) / 8;
      const McenterKNm_per_m = ((1 + nu) * wuKPa * baseOuterR ** 2) / 16;
      const rhoMinRoof = shrinkageTempRatio(fyMPa);
      const steelEdge = solveFlexuralSteel({ MuKNm: MedgeKNm_per_m, bMm: 1000, dMm: dRoofMm, fcMPa, fyMPa, rhoMinOverride: rhoMinRoof });
      const steelCenter = solveFlexuralSteel({ MuKNm: McenterKNm_per_m, bMm: 1000, dMm: dRoofMm, fcMPa, fyMPa, rhoMinOverride: rhoMinRoof });
      const barsEdge = chooseSpacingForAreaPerMeter(steelEdge.asMm2);
      const barsCenter = chooseSpacingForAreaPerMeter(steelCenter.asMm2);
      const roofVolumeM3 = Math.PI * baseOuterR ** 2 * (roofT / 1000);
      roof = {
        thicknessMm: roofT,
        methodology: 'بلاطة دائرية مسندة بجساءة (Fixed Edge) - نظرية الصفائح الكلاسيكية',
        MedgeKNm_per_m: round(MedgeKNm_per_m, 2),
        McenterKNm_per_m: round(McenterKNm_per_m, 2),
        reinforcementEdge: `Ø${barsEdge.diameterMm}mm @ ${barsEdge.spacingMm}mm (علوي عند الحواف)`,
        reinforcementCenter: `Ø${barsCenter.diameterMm}mm @ ${barsCenter.spacingMm}mm (سفلي عند المنتصف)`,
        volumeM3: round(roofVolumeM3, 3),
      };
    }

    shapeResult = {
      tankShape: 'circular',
      radiusM: round(R, 3),
      hoopTension: {
        TmaxKN_per_m: round(TmaxKN_per_m, 2),
        AsRequiredMm2PerM: round(AsHoopPerM, 0),
        reinforcementHoop: `Ø${barsHoop.diameterMm}mm @ ${barsHoop.spacingMm}mm (طوقي - أفقي، حول محيط الجدار)`,
      },
      verticalBending: {
        MuBaseKNm_per_m: round(MuBaseKNm_per_m, 2),
        reinforcementVertical: `Ø${barsVertical.diameterMm}mm @ ${barsVertical.spacingMm}mm (رأسي عند القاعدة)`,
      },
      roof,
      volumes: { wallVolumeM3: round(wallVolumeM3, 3), baseVolumeM3: round(baseVolumeM3, 3) },
      areas: {
        internalSurfaceWallM2: round(2 * Math.PI * R * totalHeightM, 2),
        baseAreaM2: round(Math.PI * R ** 2, 2),
        externalWallM2: round(2 * Math.PI * baseOuterR * totalHeightM, 2),
      },
    };
  } else {
    validateNumbers([
      ['الطول الداخلي', internalLengthM],
      ['العرض الداخلي', internalWidthM],
    ]);

    const MuBaseKNm_per_m = (WATER_UNIT_WEIGHT_KN_M3 * waterHeightM ** 3) / 6 * loadFactorFluid;
    const VuBaseKN_per_m = (WATER_UNIT_WEIGHT_KN_M3 * waterHeightM ** 2) / 2 * loadFactorFluid;
    const rhoMinWall = WATER_RETAINING_MIN_RATIO;
    const steelVertical = solveFlexuralSteel({ MuKNm: MuBaseKNm_per_m, bMm: 1000, dMm: dWallMm, fcMPa, fyMPa, rhoMinOverride: rhoMinWall });
    const barsVertical = chooseSpacingForAreaPerMeter(steelVertical.asMm2, { preferredDiameters: [10, 12, 14, 16, 20] });

    const AsHorizMinPerM = rhoMinWall * 1000 * wallThicknessMm;
    const barsHoriz = chooseSpacingForAreaPerMeter(AsHorizMinPerM, { preferredDiameters: [10, 12, 14, 16] });

    const outerL = internalLengthM + 2 * (wallThicknessMm / 1000);
    const outerW = internalWidthM + 2 * (wallThicknessMm / 1000);
    const wallVolumeM3 =
      2 * outerL * (wallThicknessMm / 1000) * totalHeightM + 2 * internalWidthM * (wallThicknessMm / 1000) * totalHeightM;
    const baseVolumeM3 = outerL * outerW * (baseThicknessMm / 1000);

    let roof = null;
    if (hasRoof) {
      const roofT = roofThicknessMm || Math.max(150, Math.ceil((Math.min(internalLengthM, internalWidthM) * 1000) / 30 / 10) * 10);
      const roofResult = calculateTwoWaySlab({
        shortSpanM: Math.min(internalLengthM, internalWidthM),
        longSpanM: Math.max(internalLengthM, internalWidthM),
        edgeConditionShort: 'continuous',
        edgeConditionLong: 'continuous',
        superimposedDeadKPa: 0.5,
        liveLoadKPa: 1.5,
        thicknessMm: roofT,
        fcMPa,
        fyMPa,
        coverMm,
        materials: { grade: materials.grade || 'C30' },
      });
      roof = { thicknessMm: roofT, slabDesign: roofResult, volumeM3: roofResult.quantities.concreteVolumeM3 };
    }

    shapeResult = {
      tankShape: 'rectangular',
      verticalBending: {
        MuBaseKNm_per_m: round(MuBaseKNm_per_m, 2),
        VuBaseKN_per_m: round(VuBaseKN_per_m, 2),
        reinforcementVertical: `Ø${barsVertical.diameterMm}mm @ ${barsVertical.spacingMm}mm (رأسي عند القاعدة، وجه المياه)`,
        reinforcementHorizontal: `Ø${barsHoriz.diameterMm}mm @ ${barsHoriz.spacingMm}mm (أفقي - كلا الوجهين)`,
      },
      roof,
      volumes: { wallVolumeM3: round(wallVolumeM3, 3), baseVolumeM3: round(baseVolumeM3, 3) },
      areas: {
        internalSurfaceWallM2: round(2 * (internalLengthM + internalWidthM) * totalHeightM, 2),
        baseAreaM2: round(internalLengthM * internalWidthM, 2),
        externalWallM2: round(2 * (outerL + outerW) * totalHeightM, 2),
      },
    };
  }

  if (tankPosition === 'elevated') {
    warnings.push('تصميم برج/أعمدة الدعامة للخزان العلوي خارج نطاق هذه الحاسبة (يُصمَّم عبر حاسبتي الأعمدة والكمرات لمنشأ الدعامة).');
  }

  const waterproofingAreaM2 = shapeResult.areas.internalSurfaceWallM2 + shapeResult.areas.baseAreaM2;
  const internalPlasterAreaM2 = waterproofingAreaM2;
  const externalPlasterAreaM2 = externalExposed ? shapeResult.areas.externalWallM2 : 0;

  const totalVolumeM3 = shapeResult.volumes.wallVolumeM3 + shapeResult.volumes.baseVolumeM3 + (shapeResult.roof ? shapeResult.roof.volumeM3 : 0);

  const materialOpts = { ...defaultMaterialOptions(), grade: 'C30', ...materials };
  const materialResult = calculateConcreteMaterials(totalVolumeM3, materialOpts);

  return {
    type: 'tank',
    tankPosition,
    geometry: { waterHeightM, freeboardM, totalHeightM: round(totalHeightM, 2), wallThicknessMm, baseThicknessMm },
    ...shapeResult,
    quantities: {
      concreteVolumeM3: round(totalVolumeM3, 3),
      waterproofingAreaM2: round(waterproofingAreaM2, 2),
      internalPlasterAreaM2: round(internalPlasterAreaM2, 2),
      externalPlasterAreaM2: round(externalPlasterAreaM2, 2),
      storageCapacityM3: round(
        tankShape === 'circular' ? Math.PI * (internalDiameterM / 2) ** 2 * waterHeightM : internalLengthM * internalWidthM * waterHeightM,
        2
      ),
    },
    materials: materialResult,
    warnings,
  };
}
