// lib/calc/rebar/stairsRebar.js
// =============================================================================
// حديد السلالم - حديد رئيسي في اتجاه الميل + توزيع، لكل فرشة، مع طول تثبيت حقيقي عند
// المساند (البسطات/الكمرات) وامتداد فعلي وليس تقريبياً
// =============================================================================

import { round } from '../common.js';
import { developmentLengthTensionMm, summarizeBarGroups } from './core.js';

function deriveRiserTread(totalHeightM, targetRiserMm = 170) {
  let risers = Math.round((totalHeightM * 1000) / targetRiserMm);
  risers = Math.max(risers, 2);
  const riserMm = (totalHeightM * 1000) / risers;
  const treadMm = Math.max(630 - 2 * riserMm, 220);
  return { risers, riserMm, treadMm };
}

export function calculateStairsRebar(inputs) {
  const {
    stairType = 'straight', // straight | L | U | circular
    totalHeightM,
    widthM,
    waistThicknessMm,
    coverMm = 20,
    fcMPa = 25,
    fyMPa = 420,
    main = { diameterMm: 12, spacingMm: 150 },
    distribution = { diameterMm: 10, spacingMm: 200 },
    supportWidthMm = 200,
    innerRadiusM = 0.35,
    outerRadiusM = 1.6,
    totalAngleDeg = 360,
    radialBar = { diameterMm: 14 },
    wastePct = 3,
    priceList,
  } = inputs;

  if (stairType === 'circular') {
    const { risers } = deriveRiserTread(totalHeightM);
    const nTreads = risers - 1;
    const stepAngleRad = ((totalAngleDeg * Math.PI) / 180) / nTreads;
    const cantileverLengthM = outerRadiusM - innerRadiusM;
    const barLengthM = cantileverLengthM + innerRadiusM * 0.3 + 0.15; // امتداد داخل العمود المركزي + خطاف تثبيت تقريبي هندسي
    const barGroups = [
      {
        label: 'حديد شعاعي أسفل كل درجة',
        diameterMm: radialBar.diameterMm,
        cuttingLengthM: round(barLengthM, 3),
        count: nTreads * 2,
      },
    ];
    const summary = summarizeBarGroups(barGroups, { wastePct, priceList });
    return {
      type: 'stairs_rebar',
      stairType: 'circular',
      geometry: { risers, nTreads, cantileverLengthM: round(cantileverLengthM, 2) },
      ...summary,
      warnings: [],
    };
  }

  const { risers, riserMm, treadMm } = deriveRiserTread(totalHeightM);
  const nFlights = stairType === 'straight' ? 1 : 2;
  const risersPerFlight = Math.ceil(risers / nFlights);
  const heightPerFlightM = totalHeightM / nFlights;
  const treadsPerFlight = risersPerFlight - 1;
  const goingPerFlightM = (treadsPerFlight * treadMm) / 1000;
  const inclinedLengthM = Math.sqrt(goingPerFlightM ** 2 + heightPerFlightM ** 2);

  const cbMm = coverMm + main.diameterMm / 2;
  const ld = developmentLengthTensionMm({ dbMm: main.diameterMm, fcMPa, fyMPa, cbMm, isTopBar: false });
  const embedmentM = Math.min(supportWidthMm - coverMm, ld) / 1000;
  const mainBarLengthM = inclinedLengthM + 2 * embedmentM;
  const mainCount = Math.floor((widthM * 1000 - 2 * coverMm) / main.spacingMm) + 1;

  const distBarLengthM = widthM - 2 * (coverMm / 1000) + 0.2;
  const distCount = Math.floor((inclinedLengthM * 1000) / distribution.spacingMm) + 1;

  const flightBarGroups = [
    { label: 'الحديد الرئيسي (اتجاه الميل)', diameterMm: main.diameterMm, cuttingLengthM: round(mainBarLengthM, 3), count: mainCount },
    { label: 'حديد التوزيع', diameterMm: distribution.diameterMm, cuttingLengthM: round(distBarLengthM, 3), count: distCount },
  ];

  const barGroups = [];
  for (let i = 0; i < nFlights; i += 1) {
    flightBarGroups.forEach((g) => barGroups.push({ ...g, label: `[فرشة ${i + 1}] ${g.label}` }));
  }

  const summary = summarizeBarGroups(barGroups, { wastePct, priceList });
  const volumeM3 = round(nFlights * widthM * inclinedLengthM * (waistThicknessMm / 1000), 3);

  return {
    type: 'stairs_rebar',
    stairType,
    geometry: {
      totalHeightM,
      widthM,
      totalRisers: risers,
      riserMm: round(riserMm, 1),
      treadMm: round(treadMm, 1),
      nFlights,
      inclinedLengthPerFlightM: round(inclinedLengthM, 2),
      volumeM3,
    },
    perFlight: { mainBarLengthM: round(mainBarLengthM, 3), mainCount, distBarLengthM: round(distBarLengthM, 3), distCount },
    ...summary,
    warnings: [],
  };
}
