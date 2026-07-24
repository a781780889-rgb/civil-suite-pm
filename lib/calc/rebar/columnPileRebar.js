// lib/calc/rebar/columnPileRebar.js
// =============================================================================
// محرك تفصيل حديد العناصر الرأسية: الأعمدة والخوازيق - حديد طولي + كانات/حلزوني
// =============================================================================

import { validateNumbers, round } from '../common.js';
import {
  developmentLengthTensionMm,
  developmentLengthCompressionMm,
  tensionLapLengthMm,
  compressionLapLengthMm,
  summarizeBarGroups,
} from './core.js';
import { calculateStirrup } from './stirrups.js';

export function calculateColumnPileRebar(inputs) {
  const {
    memberType = 'column', // column | pile
    shape = 'rectangular', // rectangular | circular
    widthMm,
    depthMm,
    diameterMm,
    heightM,
    coverMm = 40,
    fcMPa = 25,
    fyMPa = 420,
    longitudinal = { diameterMm: 20, count: 8 },
    spliceType = 'compression', // compression | tension
    includeLapAtTop = true,
    tie = { shape: 'rectangular', diameterMm: 10, spacingMm: 200, hookAngleDeg: 135, extraLegsCount: 0, sidesCount: 8 },
    wastePct = 3,
    priceList,
  } = inputs;

  validateNumbers([
    ['الارتفاع/الطول', heightM],
    ['قطر الحديد الطولي', longitudinal.diameterMm],
    ['عدد الأسياخ الطولية', longitudinal.count],
  ]);
  if (shape === 'circular') {
    validateNumbers([['القطر', diameterMm]]);
  } else {
    validateNumbers([['العرض', widthMm], ['العمق', depthMm]]);
  }

  // تقدير التباعد الفعلي بين الأسياخ الطولية لاستخدامه في معادلة طول التثبيت (cb)
  const perimeterMm = shape === 'circular' ? Math.PI * (diameterMm - 2 * coverMm) : 2 * ((widthMm - 2 * coverMm) + (depthMm - 2 * coverMm));
  const barSpacingMm = perimeterMm / Math.max(longitudinal.count, 1);
  const cbMm = Math.min(coverMm + longitudinal.diameterMm / 2, barSpacingMm / 2);

  let lapMm;
  if (spliceType === 'tension') {
    const ld = developmentLengthTensionMm({ dbMm: longitudinal.diameterMm, fcMPa, fyMPa, cbMm, isTopBar: false });
    lapMm = tensionLapLengthMm(ld, 'B');
  } else {
    lapMm = compressionLapLengthMm({ dbMm: longitudinal.diameterMm, fyMPa, fcMPa });
  }

  const requiredLengthM = heightM + (includeLapAtTop ? lapMm / 1000 : 0);

  const barGroups = [
    {
      label: `الحديد الطولي (${longitudinal.count} سيخ)`,
      diameterMm: longitudinal.diameterMm,
      cuttingLengthM: round(requiredLengthM, 3),
      count: longitudinal.count,
      lapLengthMm: lapMm,
    },
  ];

  const stirrupResult = calculateStirrup({
    shape: tie.shape,
    elementWidthMm: widthMm,
    elementHeightMm: depthMm,
    elementDiameterMm: diameterMm,
    sidesCount: tie.sidesCount,
    coverMm,
    stirrupDiaMm: tie.diameterMm,
    hookAngleDeg: tie.hookAngleDeg,
    extraLegsCount: tie.extraLegsCount,
  });

  const tieCount = Math.floor((heightM * 1000) / tie.spacingMm) + 1;
  barGroups.push({
    label: `الكانات/الأربطة (${stirrupResult.shapeLabel})`,
    diameterMm: tie.diameterMm,
    cuttingLengthM: stirrupResult.mainStirrupLengthMm / 1000,
    count: tieCount,
  });
  if (tie.extraLegsCount > 0) {
    barGroups.push({
      label: 'أشواط إضافية (Cross-ties)',
      diameterMm: tie.diameterMm,
      cuttingLengthM: stirrupResult.crossTieLengthMm / 1000,
      count: tieCount * tie.extraLegsCount,
    });
  }

  const summary = summarizeBarGroups(barGroups, { wastePct, priceList });

  const AgMm2 = shape === 'circular' ? (Math.PI / 4) * diameterMm ** 2 : widthMm * depthMm;
  const volumeM3 = round((AgMm2 / 1e6) * heightM, 3);

  return {
    type: 'column_pile_rebar',
    memberType,
    shape,
    geometry: { widthMm, depthMm, diameterMm, heightM, volumeM3 },
    splice: { spliceType, lapLengthMm: round(lapMm, 1), requiredLengthPerBarM: round(requiredLengthM, 3) },
    stirrup: stirrupResult,
    tieCount,
    ...summary,
    warnings: [],
  };
}
