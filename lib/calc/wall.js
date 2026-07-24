// lib/calc/wall.js
// =============================================================================
// حاسبة الجدران الخرسانية - تسليح أدنى وفق ACI 318 (الفصل 11) لأي جدار خرساني،
// مع خيار جدار استنادي/بدروم يُصمَّم كعنصر كابولي رأسي تحت ضغط تربة أفقي حقيقي
// بنظرية Rankine (وليس بمعامل تقريبي جاهز)
// =============================================================================

import { validateNumbers, solveFlexuralSteel, oneWayShearCapacityKN, chooseSpacingForAreaPerMeter, CONCRETE_UNIT_WEIGHT_KN_M3, round } from './common.js';
import { calculateConcreteMaterials, defaultMaterialOptions } from './materials.js';

export function calculateWall(inputs) {
  const {
    lengthM,
    heightM,
    thicknessMm,
    wallType = 'plain', // plain | retaining
    fcMPa = 25,
    fyMPa = 420,
    coverMm = 40,
    barDiaMm = 12,
    // مدخلات الجدار الاستنادي
    soilUnitWeightKNm3 = 18,
    frictionAngleDeg = 30,
    surchargeKPa = 0,
    materials = {},
  } = inputs;

  validateNumbers([
    ['طول الجدار', lengthM],
    ['ارتفاع الجدار', heightM],
    ['سماكة الجدار', thicknessMm],
    ['مقاومة الخرسانة', fcMPa],
    ['إجهاد خضوع الحديد', fyMPa],
  ]);

  const warnings = [];
  const volumeM3 = lengthM * heightM * (thicknessMm / 1000);

  // نِسَب التسليح الدنيا وفق ACI 318 §11.6 (أسياخ مشوّرة Ø≤16mm، fy≥420MPa)
  const rhoVerticalMin = fyMPa >= 420 ? 0.0012 : 0.0015;
  const rhoHorizontalMin = fyMPa >= 420 ? 0.0020 : 0.0025;

  const dMm = thicknessMm - coverMm - barDiaMm / 2;
  if (dMm <= 0) throw new Error('العمق الفعال أصبح سالباً - راجع سماكة الجدار والغطاء الخرساني.');

  let bending = null;
  if (wallType === 'retaining') {
    const phiRad = (frictionAngleDeg * Math.PI) / 180;
    const Ka = Math.tan(Math.PI / 4 - phiRad / 2) ** 2;
    const loadFactor = 1.6; // معامل تحميل ضغط التربة الجانبي (H) وفق ACI 318 5.3.1

    // عزم وقص عند قاعدة الجدار (كابولي رأسي تحت حمل مثلثي متزايد + سرشارج منتظم)
    const MuFromSoilKNm = (Ka * soilUnitWeightKNm3 * heightM ** 3) / 6;
    const MuFromSurchargeKNm = (Ka * surchargeKPa * heightM ** 2) / 2;
    const MuBaseKNm_per_m = (MuFromSoilKNm + MuFromSurchargeKNm) * loadFactor;

    const VuFromSoilKN = (Ka * soilUnitWeightKNm3 * heightM ** 2) / 2;
    const VuFromSurchargeKN = Ka * surchargeKPa * heightM;
    const VuBaseKN_per_m = (VuFromSoilKN + VuFromSurchargeKN) * loadFactor;

    const steel = solveFlexuralSteel({
      MuKNm: MuBaseKNm_per_m,
      bMm: 1000,
      dMm,
      fcMPa,
      fyMPa,
      rhoMinOverride: rhoVerticalMin,
    });
    if (!steel.isValid) warnings.push('نسبة تسليح الجدار الاستنادي تتجاوز الحد الأقصى عند القاعدة - يلزم زيادة السماكة.');

    const shearCap = oneWayShearCapacityKN({ bwMm: 1000, dMm, fcMPa });
    if (VuBaseKN_per_m > shearCap.phiVcKN) {
      warnings.push('قوة القص عند قاعدة الجدار تتجاوز قدرة الخرسانة وحدها - يلزم زيادة السماكة.');
    }

    const bars = chooseSpacingForAreaPerMeter(steel.asMm2, { preferredDiameters: [12, 14, 16, 18, 20] });

    bending = {
      Ka: round(Ka, 3),
      loadFactor,
      MuBaseKNm_per_m: round(MuBaseKNm_per_m, 2),
      VuBaseKN_per_m: round(VuBaseKN_per_m, 2),
      phiVcKN_per_m: round(shearCap.phiVcKN, 2),
      steel: { ...steel, asMm2: round(steel.asMm2, 0) },
      reinforcementVerticalMain: `Ø${bars.diameterMm}mm @ ${bars.spacingMm}mm (وجه التربة - رأسي رئيسي عند القاعدة)`,
      note: 'التصميم لجذع الجدار كعنصر كابولي مستقل. استقرار المنشأة الكاملة (الانزلاق والانقلاب) يتطلب تصميم قاعدة الجدار عبر حاسبة القواعد.',
    };
  }

  const AsVerticalPerM = rhoVerticalMin * 1000 * thicknessMm;
  const AsHorizontalPerM = rhoHorizontalMin * 1000 * thicknessMm;
  const barsVerticalMin = chooseSpacingForAreaPerMeter(AsVerticalPerM, { preferredDiameters: [10, 12, 14] });
  const barsHorizontalMin = chooseSpacingForAreaPerMeter(AsHorizontalPerM, { preferredDiameters: [10, 12, 14] });

  const verticalBars = bending ? chooseSpacingForAreaPerMeter(Math.max(bending.steel.asMm2, AsVerticalPerM), { preferredDiameters: [12, 14, 16, 18, 20] }) : barsVerticalMin;

  const layers = 2; // وجهان (طبقتان) للتسليح الرأسي والأفقي
  const verticalWeightKg = layers * (lengthM / (verticalBars.spacingMm / 1000)) * heightM * ((Math.PI / 4) * verticalBars.diameterMm ** 2 * 7850) / 1e6;
  const horizontalWeightKg = layers * (heightM / (barsHorizontalMin.spacingMm / 1000)) * lengthM * ((Math.PI / 4) * barsHorizontalMin.diameterMm ** 2 * 7850) / 1e6;
  const steelWeightKg = verticalWeightKg + horizontalWeightKg;

  const materialOpts = { ...defaultMaterialOptions(), ...materials };
  const materialResult = calculateConcreteMaterials(volumeM3, materialOpts);

  return {
    type: 'wall',
    wallType,
    geometry: { lengthM, heightM, thicknessMm, effectiveDepthMm: round(dMm, 1) },
    minimumReinforcement: {
      rhoVerticalMinPct: round(rhoVerticalMin * 100, 3),
      rhoHorizontalMinPct: round(rhoHorizontalMin * 100, 3),
      reinforcementVertical: `Ø${barsVerticalMin.diameterMm}mm @ ${barsVerticalMin.spacingMm}mm (وجهان)`,
      reinforcementHorizontal: `Ø${barsHorizontalMin.diameterMm}mm @ ${barsHorizontalMin.spacingMm}mm (وجهان)`,
    },
    retainingDesign: bending,
    quantities: { concreteVolumeM3: round(volumeM3, 3), steelWeightKg: round(steelWeightKg, 1) },
    materials: materialResult,
    warnings,
  };
}
