// lib/calc/stairs.js
// =============================================================================
// حاسبة السلالم - هندسة حقيقية للقائمة والنائمة (معادلة الراحة 2R+T=630mm)، حجم القلبة
// والدرجات من الأبعاد الفعلية، وتصميم إنشائي كبلاطة مائلة أحادية الاتجاه وفق ACI 318.
// تدعم: مستقيم، L، U، ودائري (كابولي من عمود مركزي).
// =============================================================================

import { validateNumbers, solveFlexuralSteel, shrinkageTempRatio, chooseSpacingForAreaPerMeter, CONCRETE_UNIT_WEIGHT_KN_M3, round } from './common.js';
import { calculateConcreteMaterials, defaultMaterialOptions } from './materials.js';

const COMFORT_SUM_MM = 630; // معادلة الراحة القياسية 2R + T = 630mm (بين 600-650 حسب الممارسة)

/** تحديد عدد وارتفاع القوائم وعرض النائمة من الارتفاع الكلي، مع إمكانية التجاوز اليدوي */
export function deriveRiserTread(totalHeightM, { riserMmOverride = null, treadMmOverride = null, targetRiserMm = 170 } = {}) {
  const totalHeightMm = totalHeightM * 1000;
  let risers = Math.round(totalHeightMm / (riserMmOverride || targetRiserMm));
  risers = Math.max(risers, 2);
  const riserMm = riserMmOverride || totalHeightMm / risers;
  const treadMm = treadMmOverride || Math.max(COMFORT_SUM_MM - 2 * riserMm, 220);
  return { risers, treadMm, riserMm, comfortCheck: 2 * riserMm + treadMm };
}

function designFlightStrip({ goingM, riseM, widthM, waistThicknessMm, nRisers, nTreads, riserMm, treadMm, liveLoadKPa, fcMPa, fyMPa, coverMm, barDiaMm, supportType }) {
  const angleRad = Math.atan(riseM / goingM);
  const inclinedLengthM = Math.sqrt(goingM ** 2 + riseM ** 2);

  // الوزن الذاتي المكافئ أفقياً: سماكة القلبة مُسقطة على الميل + وزن الدرجات المثلثية (نصف القائمة تقريباً)
  const equivalentThicknessM = waistThicknessMm / 1000 / Math.cos(angleRad) + riserMm / 1000 / 2;
  const selfWeightKPa = equivalentThicknessM * CONCRETE_UNIT_WEIGHT_KN_M3;
  const finishesKPa = 1.0; // حمل تشطيبات (رخام/بلاط + مونة) تقديري قابل للتعديل من الواجهة مستقبلاً
  const totalDeadKPa = selfWeightKPa + finishesKPa;
  const wuKPa = 1.2 * totalDeadKPa + 1.6 * (liveLoadKPa || 4.0);

  const coef = supportType === 'continuous' ? 12 : 8;
  const MuKNm_per_m = (wuKPa * goingM ** 2) / coef;
  const VuKN_per_m = (wuKPa * goingM) / 2;

  const dMm = waistThicknessMm - coverMm - barDiaMm / 2;
  const rhoMinSlab = shrinkageTempRatio(fyMPa);
  const steel = solveFlexuralSteel({ MuKNm: MuKNm_per_m, bMm: 1000, dMm, fcMPa, fyMPa, rhoMinOverride: rhoMinSlab });
  const bars = chooseSpacingForAreaPerMeter(steel.asMm2, { preferredDiameters: [10, 12, 14, 16] });

  const AsDistPerM = rhoMinSlab * 1000 * dMm;
  const barsDist = chooseSpacingForAreaPerMeter(AsDistPerM, { preferredDiameters: [8, 10, 12] });

  const waistVolumeM3 = widthM * inclinedLengthM * (waistThicknessMm / 1000);
  const stepsVolumeM3 = widthM * (0.5 * (riserMm / 1000) * (treadMm / 1000)) * nTreads;
  const flightVolumeM3 = waistVolumeM3 + stepsVolumeM3;

  const formworkAreaM2 = widthM * inclinedLengthM + nTreads * (riserMm / 1000) * widthM;

  const mainWeightKg = (widthM / (bars.spacingMm / 1000)) * inclinedLengthM * ((Math.PI / 4) * bars.diameterMm ** 2 * 7850) / 1e6;
  const distWeightKg = (inclinedLengthM / (barsDist.spacingMm / 1000)) * widthM * ((Math.PI / 4) * barsDist.diameterMm ** 2 * 7850) / 1e6;
  const steelWeightKg = mainWeightKg + distWeightKg;

  return {
    angleDeg: round((angleRad * 180) / Math.PI, 1),
    inclinedLengthM: round(inclinedLengthM, 2),
    goingM: round(goingM, 2),
    riseM: round(riseM, 2),
    nRisers,
    nTreads,
    riserMm: round(riserMm, 1),
    treadMm: round(treadMm, 1),
    loads: { selfWeightKPa: round(selfWeightKPa, 2), totalDeadKPa: round(totalDeadKPa, 2), wuKPa: round(wuKPa, 2) },
    flexure: {
      MuKNm_per_m: round(MuKNm_per_m, 2),
      VuKN_per_m: round(VuKN_per_m, 2),
      effectiveDepthMm: round(dMm, 1),
      steel: { ...steel, asMm2: round(steel.asMm2, 0) },
      reinforcementMain: `Ø${bars.diameterMm}mm @ ${bars.spacingMm}mm (رئيسي - اتجاه الميل)`,
      reinforcementDistribution: `Ø${barsDist.diameterMm}mm @ ${barsDist.spacingMm}mm (توزيع)`,
    },
    quantities: {
      waistVolumeM3: round(waistVolumeM3, 3),
      stepsVolumeM3: round(stepsVolumeM3, 3),
      flightVolumeM3: round(flightVolumeM3, 3),
      formworkAreaM2: round(formworkAreaM2, 2),
      steelWeightKg: round(steelWeightKg, 1),
    },
  };
}

export function calculateStairs(inputs) {
  const {
    stairType = 'straight', // straight | L | U | circular
    totalHeightM,
    widthM,
    waistThicknessMm,
    riserMmOverride = null,
    treadMmOverride = null,
    liveLoadKPa = 4.0,
    fcMPa = 25,
    fyMPa = 420,
    coverMm = 20,
    barDiaMm = 12,
    landingThicknessMm = null,
    landingWidthM = null,
    supportType = 'simple',
    materials = {},
    // للدرج الدائري
    innerRadiusM = 0.35,
    outerRadiusM = 1.5,
    totalAngleDeg = 360,
  } = inputs;

  validateNumbers([
    ['الارتفاع الكلي', totalHeightM],
    ['عرض الدرج', widthM, { required: stairType !== 'circular' }],
  ]);

  const warnings = [];
  const materialOpts = { ...defaultMaterialOptions(), ...materials };

  if (stairType === 'circular') {
    validateNumbers([
      ['نصف القطر الداخلي', innerRadiusM],
      ['نصف القطر الخارجي', outerRadiusM],
      ['الزاوية الكلية', totalAngleDeg],
    ]);
    if (outerRadiusM <= innerRadiusM) throw new Error('يجب أن يكون نصف القطر الخارجي أكبر من الداخلي.');

    const { risers, treadMm, riserMm } = deriveRiserTread(totalHeightM, { riserMmOverride, treadMmOverride });
    const nTreads = risers - 1;
    const totalAngleRad = (totalAngleDeg * Math.PI) / 180;
    const stepAngleRad = totalAngleRad / nTreads;
    const walkLineRadiusM = (innerRadiusM + outerRadiusM) / 2;
    const walkLineTreadMm = walkLineRadiusM * stepAngleRad * 1000;
    if (walkLineTreadMm < 200) {
      warnings.push('عرض النائمة عند خط السير أقل من 200mm - يُفضّل تقليل عدد الدرجات أو زيادة نصف القطر الخارجي.');
    }

    const sectorAreaM2 = 0.5 * (outerRadiusM ** 2 - innerRadiusM ** 2) * stepAngleRad;
    const stepVolumeM3 = sectorAreaM2 * (riserMm / 1000);
    const allStepsVolumeM3 = stepVolumeM3 * nTreads;
    const columnVolumeM3 = Math.PI * innerRadiusM ** 2 * totalHeightM;
    const totalVolumeM3 = allStepsVolumeM3 + columnVolumeM3;

    // تصميم الدرجة ككابولي من العمود المركزي (بعرض متوسط عند خط السير)
    const cantileverLengthM = outerRadiusM - innerRadiusM;
    const avgWidthM = walkLineRadiusM * stepAngleRad;
    const wuKPa_local = 1.2 * (riserMm / 1000 * CONCRETE_UNIT_WEIGHT_KN_M3 + 1.0) + 1.6 * liveLoadKPa;
    const MuKNm_per_m = (wuKPa_local * cantileverLengthM ** 2) / 2;
    const dMm = riserMm - coverMm - barDiaMm / 2 > 80 ? riserMm - coverMm - barDiaMm / 2 : Math.max(riserMm * 0.6, 80);
    const rhoMinSlab = shrinkageTempRatio(fyMPa);
    const steel = solveFlexuralSteel({ MuKNm: MuKNm_per_m, bMm: 1000, dMm, fcMPa, fyMPa, rhoMinOverride: rhoMinSlab });
    const bars = chooseSpacingForAreaPerMeter(steel.asMm2, { preferredDiameters: [12, 14, 16, 20] });
    if (!steel.isValid) warnings.push('سماكة الدرجة (بارتفاع القائمة) غير كافية لتحمل عزم الكابولي - يُنصح بزيادة نصف القطر الداخلي (العمود) أو تسليح إضافي مُصمَّم تفصيلياً.');

    // العمود المركزي: تحقق محوري مبسّط (الحمل المتجمع من جميع الدرجات + وزنه الذاتي)، دون تأثير العزم الالتوائي (خارج النطاق)
    const totalLoadKN = totalVolumeM3 * CONCRETE_UNIT_WEIGHT_KN_M3 + sectorAreaM2 * nTreads * liveLoadKPa;
    const PuColumnKN = 1.2 * (totalVolumeM3 * CONCRETE_UNIT_WEIGHT_KN_M3) + 1.6 * (sectorAreaM2 * nTreads * liveLoadKPa);
    const AgColumnMm2 = Math.PI * (innerRadiusM * 1000) ** 2;
    const phiPnMaxKN = (0.80 * 0.65 * (0.85 * fcMPa * AgColumnMm2 * 0.99)) / 1000; // بافتراض تسليح أدنى 1% تقريبياً للتحقق السريع
    if (PuColumnKN > phiPnMaxKN) {
      warnings.push('الحمل المحوري على العمود المركزي مرتفع نسبياً لقطره - يُنصح بزيادة نصف القطر الداخلي.');
    }

    const materialResult = calculateConcreteMaterials(totalVolumeM3, materialOpts);

    return {
      type: 'stairs',
      stairType: 'circular',
      geometry: {
        innerRadiusM,
        outerRadiusM,
        totalAngleDeg,
        risers,
        nTreads,
        riserMm: round(riserMm, 1),
        walkLineTreadMm: round(walkLineTreadMm, 1),
        walkLineRadiusM: round(walkLineRadiusM, 2),
        cantileverLengthM: round(cantileverLengthM, 2),
      },
      flexure: {
        MuKNm_per_m: round(MuKNm_per_m, 2),
        effectiveDepthMm: round(dMm, 0),
        reinforcement: `Ø${bars.diameterMm}mm @ ${bars.spacingMm}mm (شعاعي - أسفل كل درجة)`,
      },
      centralColumn: {
        diameterM: round(innerRadiusM * 2, 2),
        PuKN: round(PuColumnKN, 1),
        phiPnMaxKN: round(phiPnMaxKN, 1),
        note: 'تحقق محوري مبسّط. تأثيرات الالتواء والانحناء ثنائي المحور في العمود المركزي تتطلب تحليلاً إنشائياً تفصيلياً منفصلاً.',
      },
      quantities: {
        stepVolumeM3: round(stepVolumeM3, 4),
        allStepsVolumeM3: round(allStepsVolumeM3, 3),
        columnVolumeM3: round(columnVolumeM3, 3),
        concreteVolumeM3: round(totalVolumeM3, 3),
      },
      materials: materialResult,
      warnings,
    };
  }

  // ---- مستقيم / L / U ----
  const { risers, treadMm, riserMm } = deriveRiserTread(totalHeightM, { riserMmOverride, treadMmOverride });
  const nFlights = stairType === 'straight' ? 1 : 2;
  const risersPerFlight = Math.ceil(risers / nFlights);
  const heightPerFlightM = totalHeightM / nFlights;
  const treadsPerFlight = risersPerFlight - 1;
  const goingPerFlightM = (treadsPerFlight * treadMm) / 1000;

  const flights = [];
  for (let i = 0; i < nFlights; i += 1) {
    flights.push(
      designFlightStrip({
        goingM: goingPerFlightM,
        riseM: heightPerFlightM,
        widthM,
        waistThicknessMm,
        nRisers: risersPerFlight,
        nTreads: treadsPerFlight,
        riserMm,
        treadMm,
        liveLoadKPa,
        fcMPa,
        fyMPa,
        coverMm,
        barDiaMm,
        supportType,
      })
    );
  }

  let landing = null;
  if (nFlights > 1) {
    const landW = landingWidthM || widthM;
    const landT = landingThicknessMm || waistThicknessMm;
    const landingSpanM = stairType === 'U' ? widthM : landW; // تبسيط: بحر البسطة يقارب عرض الدرج
    const selfWeightKPa = (landT / 1000) * CONCRETE_UNIT_WEIGHT_KN_M3;
    const wuKPa = 1.2 * (selfWeightKPa + 1.0) + 1.6 * liveLoadKPa;
    const dMm = landT - coverMm - barDiaMm / 2;
    const MuKNm_per_m = (wuKPa * landingSpanM ** 2) / 8;
    const rhoMinSlab = shrinkageTempRatio(fyMPa);
    const steel = solveFlexuralSteel({ MuKNm: MuKNm_per_m, bMm: 1000, dMm, fcMPa, fyMPa, rhoMinOverride: rhoMinSlab });
    const bars = chooseSpacingForAreaPerMeter(steel.asMm2, { preferredDiameters: [10, 12, 14, 16] });
    const landingAreaM2 = landW * widthM;
    const landingVolumeM3 = landingAreaM2 * (landT / 1000);
    const landingSteelKg = (landW / (bars.spacingMm / 1000)) * widthM * ((Math.PI / 4) * bars.diameterMm ** 2 * 7850) / 1e6 * 1.4;
    landing = {
      widthM: landW,
      lengthM: widthM,
      thicknessMm: landT,
      MuKNm_per_m: round(MuKNm_per_m, 2),
      reinforcement: `Ø${bars.diameterMm}mm @ ${bars.spacingMm}mm (كلا الاتجاهين)`,
      areaM2: round(landingAreaM2, 2),
      volumeM3: round(landingVolumeM3, 3),
      steelWeightKg: round(landingSteelKg, 1),
    };
  }

  const totalConcreteM3 =
    flights.reduce((s, f) => s + f.quantities.flightVolumeM3, 0) + (landing ? landing.volumeM3 : 0);
  const totalSteelKg =
    flights.reduce((s, f) => s + f.quantities.steelWeightKg, 0) + (landing ? landing.steelWeightKg : 0);
  const totalFormworkM2 = flights.reduce((s, f) => s + f.quantities.formworkAreaM2, 0) + (landing ? landing.areaM2 : 0);

  const materialResult = calculateConcreteMaterials(totalConcreteM3, materialOpts);

  return {
    type: 'stairs',
    stairType,
    geometry: { totalHeightM, widthM, totalRisers: risers, riserMm: round(riserMm, 1), treadMm: round(treadMm, 1), comfortFormula: '2R + T = 630mm' },
    flights,
    landing,
    quantities: {
      concreteVolumeM3: round(totalConcreteM3, 3),
      steelWeightKg: round(totalSteelKg, 1),
      formworkAreaM2: round(totalFormworkM2, 2),
    },
    materials: materialResult,
    warnings,
  };
}
