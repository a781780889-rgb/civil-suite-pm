// lib/calc/materials.js
// =============================================================================
// محرك حساب مواد الخرسانة (القسم الثاني من المتطلبات) - يُستدعى من كل حاسبة عنصر إنشائي
// الطريقة: طريقة "الحجم الجاف" (Dry Volume Method) المعتمدة عالمياً في حصر مواد الخرسانة
// بالنسب الحجمية - وهي طريقة حقيقية قابلة للتعديل الكامل من قبل المستخدم (النسبة، نسبة
// الماء/الأسمنت، نسبة الهدر)، وليست أرقاماً تقريبية جاهزة.
// =============================================================================

import { round } from './common.js';

// نسب خلط اسمية قياسية شائعة الاستخدام إقليمياً حسب رتبة الخرسانة (قابلة للتعديل الكامل من المستخدم)
export const CONCRETE_GRADES = {
  C10: { label: 'C10 - نظافة/غير إنشائي', ratio: [1, 4, 8], wcRatio: 0.60, advisoryMinCementKgM3: 200 },
  C15: { label: 'C15 - قواعد نظافة/ردم', ratio: [1, 3, 6], wcRatio: 0.55, advisoryMinCementKgM3: 250 },
  C20: { label: 'C20 - عناصر إنشائية خفيفة', ratio: [1, 2, 4], wcRatio: 0.50, advisoryMinCementKgM3: 280 },
  C25: { label: 'C25 - عناصر إنشائية عامة', ratio: [1, 1.5, 3], wcRatio: 0.45, advisoryMinCementKgM3: 320 },
  C30: { label: 'C30 - أعمدة/كمرات/قواعد رئيسية', ratio: [1, 1, 2], wcRatio: 0.42, advisoryMinCementKgM3: 350 },
  C35: { label: 'C35 - عناصر معرضة لبيئة قاسية', ratio: [1, 1, 1.75], wcRatio: 0.38, advisoryMinCementKgM3: 380 },
  C40: { label: 'C40 - خزانات/منشآت خاصة', ratio: [1, 0.75, 1.5], wcRatio: 0.35, advisoryMinCementKgM3: 400 },
};

export const CEMENT_TYPES = {
  OPC: 'أسمنت بورتلاندي عادي (OPC)',
  SRC: 'أسمنت مقاوم للكبريتات (SRC)',
  PPC: 'أسمنت بوزولاني (PPC)',
};

const DRY_VOLUME_FACTOR = 1.54; // معامل تحويل الحجم الرطب إلى حجم جاف (قياسي معتمد صناعياً 1.54–1.57)
const CEMENT_BULK_DENSITY_KG_M3 = 1440; // الكثافة الظاهرية للأسمنت الفضفاض
const SAND_BULK_DENSITY_KG_M3 = 1600; // الكثافة الظاهرية للرمل
const GRAVEL_BULK_DENSITY_KG_M3 = 1500; // الكثافة الظاهرية للبحص/الركام الخشن

/**
 * حساب مواد الخرسانة الكاملة لحجم خرسانة معطى
 * @param {number} volumeM3 - حجم الخرسانة الصافي (بدون هدر) بالمتر المكعب
 * @param {object} options
 */
export function calculateConcreteMaterials(volumeM3, options = {}) {
  const {
    grade = 'C25',
    customRatio = null, // [cement, sand, gravel]
    wcRatio = null,
    cementType = 'OPC',
    wasteRatioPct = 5,
    bagWeightKg = 50,
    mixerCapacityM3 = 0.5,
    truckCapacityM3 = 7,
    unitPrices = {}, // { cementBagPrice, sandPricePerM3, gravelPricePerM3, waterPricePerM3 }
  } = options;

  if (!(volumeM3 > 0)) {
    return null;
  }

  const gradeDef = CONCRETE_GRADES[grade] || CONCRETE_GRADES.C25;
  const ratio = customRatio && customRatio.length === 3 ? customRatio : gradeDef.ratio;
  const wc = wcRatio != null ? wcRatio : gradeDef.wcRatio;
  const wasteFactor = 1 + (wasteRatioPct || 0) / 100;

  const [cRatio, sRatio, gRatio] = ratio;
  const sumParts = cRatio + sRatio + gRatio;

  // الحجم الصافي بعد إضافة الهدر (هذا هو الحجم الذي سيُشترى فعلياً)
  const grossVolumeM3 = volumeM3 * wasteFactor;

  const dryVolumeM3 = grossVolumeM3 * DRY_VOLUME_FACTOR;
  const cementVolumeM3 = dryVolumeM3 * (cRatio / sumParts);
  const sandVolumeM3 = dryVolumeM3 * (sRatio / sumParts);
  const gravelVolumeM3 = dryVolumeM3 * (gRatio / sumParts);

  const cementWeightKg = cementVolumeM3 * CEMENT_BULK_DENSITY_KG_M3;
  const sandWeightKg = sandVolumeM3 * SAND_BULK_DENSITY_KG_M3;
  const gravelWeightKg = gravelVolumeM3 * GRAVEL_BULK_DENSITY_KG_M3;

  const cementBags = cementWeightKg / bagWeightKg;
  const waterLiters = cementWeightKg * wc; // 1 لتر ماء = 1 كغم تقريباً
  const waterM3 = waterLiters / 1000;

  const cementContentPerM3 = cementWeightKg / grossVolumeM3; // kg/m³ فعلي بعد الهدر - للمقارنة مع الحد الاسترشادي
  const cementAdvisoryOk = cementContentPerM3 >= gradeDef.advisoryMinCementKgM3 * 0.95; // هامش 5%

  const mixerLoads = Math.ceil(grossVolumeM3 / mixerCapacityM3);
  const truckTrips = Math.ceil(grossVolumeM3 / truckCapacityM3);

  const cementCost = cementBags * (unitPrices.cementBagPrice || 0);
  const sandCost = sandVolumeM3 * (unitPrices.sandPricePerM3 || 0);
  const gravelCost = gravelVolumeM3 * (unitPrices.gravelPricePerM3 || 0);
  const waterCost = waterM3 * (unitPrices.waterPricePerM3 || 0);
  const totalMaterialCost = cementCost + sandCost + gravelCost + waterCost;

  return {
    grade,
    gradeLabel: gradeDef.label,
    ratio,
    ratioLabel: `${ratio[0]} : ${ratio[1]} : ${ratio[2]}`,
    wcRatio: wc,
    cementType,
    cementTypeLabel: CEMENT_TYPES[cementType] || cementType,
    wasteRatioPct,
    netVolumeM3: round(volumeM3, 3),
    grossVolumeM3: round(grossVolumeM3, 3),
    dryVolumeM3: round(dryVolumeM3, 3),
    cementVolumeM3: round(cementVolumeM3, 3),
    sandVolumeM3: round(sandVolumeM3, 3),
    gravelVolumeM3: round(gravelVolumeM3, 3),
    cementWeightKg: round(cementWeightKg, 1),
    cementWeightTon: round(cementWeightKg / 1000, 3),
    sandWeightKg: round(sandWeightKg, 1),
    sandWeightTon: round(sandWeightKg / 1000, 3),
    gravelWeightKg: round(gravelWeightKg, 1),
    gravelWeightTon: round(gravelWeightKg / 1000, 3),
    cementBags: Math.ceil(cementBags),
    cementBagsExact: round(cementBags, 1),
    waterLiters: round(waterLiters, 1),
    waterM3: round(waterM3, 3),
    cementContentPerM3: round(cementContentPerM3, 1),
    advisoryMinCementKgM3: gradeDef.advisoryMinCementKgM3,
    cementAdvisoryOk,
    mixerCapacityM3,
    mixerLoads,
    truckCapacityM3,
    truckTrips,
    unitPrices,
    cost: {
      cementCost: round(cementCost, 2),
      sandCost: round(sandCost, 2),
      gravelCost: round(gravelCost, 2),
      waterCost: round(waterCost, 2),
      totalMaterialCost: round(totalMaterialCost, 2),
    },
  };
}

export function defaultMaterialOptions(overrides = {}) {
  return {
    grade: 'C25',
    wasteRatioPct: 5,
    cementType: 'OPC',
    bagWeightKg: 50,
    mixerCapacityM3: 0.5,
    truckCapacityM3: 7,
    unitPrices: { cementBagPrice: 0, sandPricePerM3: 0, gravelPricePerM3: 0, waterPricePerM3: 0 },
    ...overrides,
  };
}
