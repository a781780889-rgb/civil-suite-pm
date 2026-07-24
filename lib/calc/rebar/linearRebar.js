// lib/calc/rebar/linearRebar.js
// =============================================================================
// محرك تفصيل حديد العناصر الأفقية الخطية: الكمرات، الميدات (الشدادات الأرضية)، والجسور
// حديد طولي علوي/سفلي + كانات، مع طول تثبيت حقيقي عند المساند (مستقيم أو بخطاف)
// =============================================================================

import { validateNumbers, round } from '../common.js';
import { developmentLengthTensionMm, hookLengthMm, summarizeBarGroups } from './core.js';
import { calculateStirrup } from './stirrups.js';

function longitudinalGroup({ label, spanM, numberOfSpans, supportWidthMm, coverMm, diameterMm, count, fcMPa, fyMPa, isTopBar, barSpacingMm }) {
  const totalSpanM = spanM * numberOfSpans;
  const cbMm = Math.min(coverMm + diameterMm / 2, (barSpacingMm - diameterMm) / 2);
  const ld = developmentLengthTensionMm({ dbMm: diameterMm, fcMPa, fyMPa, cbMm, isTopBar });

  const availableEmbedmentMm = Math.max(supportWidthMm - coverMm, 0);
  const needsHook = availableEmbedmentMm < ld;
  const hook = needsHook ? hookLengthMm(diameterMm, 90, 'primary') : 0;
  const embedmentEachEndM = (needsHook ? availableEmbedmentMm + hook : Math.max(availableEmbedmentMm, ld)) / 1000;

  const cuttingLengthM = totalSpanM + 2 * embedmentEachEndM;

  return {
    label,
    diameterMm,
    count,
    cuttingLengthM: round(cuttingLengthM, 3),
    developmentLengthMm: round(ld, 1),
    needsHook,
    note: needsHook
      ? `عرض المسند (${supportWidthMm}mm) لا يكفي لتثبيت مستقيم (ld=${round(ld, 0)}mm) - أُضيف خطاف 90° عند الطرفين`
      : 'التثبيت داخل المسند مستقيم وكافٍ',
  };
}

export function calculateLinearRebar(inputs) {
  const {
    memberFamily = 'beam', // beam | tie_beam | girder
    spanM,
    numberOfSpans = 1,
    supportWidthMm = 400,
    widthMm,
    heightMm,
    coverMm = 40,
    fcMPa = 25,
    fyMPa = 420,
    bottom = { diameterMm: 20, count: 3 },
    top = { diameterMm: 16, count: 2 },
    hasTop = true,
    stirrup = { diameterMm: 10, spacingMm: 200, hookAngleDeg: 135, extraLegsCount: 0 },
    wastePct = 3,
    priceList,
  } = inputs;

  validateNumbers([
    ['البحر', spanM],
    ['عرض المقطع', widthMm],
    ['ارتفاع المقطع', heightMm],
    ['قطر الحديد السفلي', bottom.diameterMm],
    ['عدد الأسياخ السفلية', bottom.count],
  ]);

  const bottomBarSpacingMm = (widthMm - 2 * coverMm) / Math.max(bottom.count - 1, 1);
  const bottomGroup = longitudinalGroup({
    label: 'الحديد السفلي',
    spanM,
    numberOfSpans,
    supportWidthMm,
    coverMm,
    diameterMm: bottom.diameterMm,
    count: bottom.count,
    fcMPa,
    fyMPa,
    isTopBar: false,
    barSpacingMm: bottomBarSpacingMm,
  });

  const barGroups = [bottomGroup];
  let topGroup = null;
  if (hasTop) {
    const topBarSpacingMm = (widthMm - 2 * coverMm) / Math.max(top.count - 1, 1);
    topGroup = longitudinalGroup({
      label: 'الحديد العلوي',
      spanM,
      numberOfSpans,
      supportWidthMm,
      coverMm,
      diameterMm: top.diameterMm,
      count: top.count,
      fcMPa,
      fyMPa,
      isTopBar: true,
      barSpacingMm: topBarSpacingMm,
    });
    barGroups.push(topGroup);
  }

  const stirrupResult = calculateStirrup({
    shape: 'rectangular',
    elementWidthMm: widthMm,
    elementHeightMm: heightMm,
    coverMm,
    stirrupDiaMm: stirrup.diameterMm,
    hookAngleDeg: stirrup.hookAngleDeg,
    extraLegsCount: stirrup.extraLegsCount,
  });
  const stirrupCount = Math.floor((spanM * numberOfSpans * 1000) / stirrup.spacingMm) + numberOfSpans;
  barGroups.push({
    label: 'الكانات',
    diameterMm: stirrup.diameterMm,
    cuttingLengthM: stirrupResult.mainStirrupLengthMm / 1000,
    count: stirrupCount,
  });
  if (stirrup.extraLegsCount > 0) {
    barGroups.push({
      label: 'أشواط الكانات الإضافية',
      diameterMm: stirrup.diameterMm,
      cuttingLengthM: stirrupResult.crossTieLengthMm / 1000,
      count: stirrupCount * stirrup.extraLegsCount,
    });
  }

  const summary = summarizeBarGroups(barGroups, { wastePct, priceList });
  const volumeM3 = round((widthMm / 1000) * (heightMm / 1000) * spanM * numberOfSpans, 3);

  return {
    type: 'linear_rebar',
    memberFamily,
    geometry: { spanM, numberOfSpans, widthMm, heightMm, totalLengthM: round(spanM * numberOfSpans, 2), volumeM3 },
    bottom: bottomGroup,
    top: topGroup,
    stirrup: stirrupResult,
    stirrupCount,
    ...summary,
    warnings: [bottomGroup, topGroup].filter((g) => g?.needsHook).map((g) => `${g.label}: ${g.note}`),
  };
}
