// lib/calc/rebar/wallPanelRebar.js
// =============================================================================
// محرك تفصيل حديد الجدران (عادية/خزانات/مسابح) - مستقيمة أو دائرية (حديد أفقي كحلقات مغلقة)
// =============================================================================

import { validateNumbers, round } from '../common.js';
import { developmentLengthTensionMm, tensionLapLengthMm, summarizeBarGroups } from './core.js';

export function calculateWallPanelRebar(inputs) {
  const {
    usageContext = 'wall', // wall | tank | pool
    wallShape = 'straight', // straight | circular
    lengthM,
    diameterM,
    heightM,
    thicknessMm,
    coverMm = 40,
    fcMPa = 25,
    fyMPa = 420,
    vertical = { diameterMm: 12, spacingMm: 200 },
    horizontal = { diameterMm: 12, spacingMm: 200 },
    layers = 2,
    wastePct = 3,
    priceList,
  } = inputs;

  validateNumbers([
    ['الارتفاع', heightM],
    ['السماكة', thicknessMm],
    ['قطر الحديد الرأسي', vertical.diameterMm],
    ['تباعد الحديد الرأسي', vertical.spacingMm],
    ['قطر الحديد الأفقي', horizontal.diameterMm],
    ['تباعد الحديد الأفقي', horizontal.spacingMm],
  ]);

  const planLengthM = wallShape === 'circular' ? Math.PI * diameterM : lengthM;
  if (!(planLengthM > 0)) throw new Error('يلزم إدخال الطول أو القطر حسب شكل الجدار.');

  const cbV = Math.min(coverMm + vertical.diameterMm / 2, (vertical.spacingMm - vertical.diameterMm) / 2);
  const ldVertical = developmentLengthTensionMm({ dbMm: vertical.diameterMm, fcMPa, fyMPa, cbMm: cbV, isTopBar: false });

  // الحديد الرأسي: يمتد بكامل الارتفاع + طول تثبيت داخل القاعدة
  const verticalBarLengthM = heightM + ldVertical / 1000;
  const verticalCountPerLayer = Math.floor((planLengthM * 1000 - 2 * coverMm) / vertical.spacingMm) + 1;
  const verticalCount = verticalCountPerLayer * layers;

  const barGroups = [
    {
      label: 'الحديد الرأسي',
      diameterMm: vertical.diameterMm,
      cuttingLengthM: round(verticalBarLengthM, 3),
      count: verticalCount,
    },
  ];

  if (wallShape === 'circular') {
    // الحديد الأفقي حلقات مغلقة - طول الحلقة = المحيط + طول تراكب واحد لإغلاقها
    const cbH = Math.min(coverMm + horizontal.diameterMm / 2, (horizontal.spacingMm - horizontal.diameterMm) / 2);
    const ldHorizontal = developmentLengthTensionMm({ dbMm: horizontal.diameterMm, fcMPa, fyMPa, cbMm: cbH, isTopBar: false });
    const lapMm = tensionLapLengthMm(ldHorizontal, 'B');
    const ringLengthM = planLengthM + lapMm / 1000;
    const horizontalCountPerLayer = Math.floor((heightM * 1000) / horizontal.spacingMm) + 1;
    barGroups.push({
      label: 'الحديد الأفقي (حلقات مغلقة)',
      diameterMm: horizontal.diameterMm,
      cuttingLengthM: round(ringLengthM, 3),
      count: horizontalCountPerLayer * layers,
      lapLengthMm: lapMm,
    });
  } else {
    const horizontalBarLengthM = planLengthM - 2 * (coverMm / 1000) + 2 * 0.15;
    const horizontalCountPerLayer = Math.floor((heightM * 1000) / horizontal.spacingMm) + 1;
    barGroups.push({
      label: 'الحديد الأفقي',
      diameterMm: horizontal.diameterMm,
      cuttingLengthM: round(horizontalBarLengthM, 3),
      count: horizontalCountPerLayer * layers,
    });
  }

  const summary = summarizeBarGroups(barGroups, { wastePct, priceList });
  const areaM2 = round(planLengthM * heightM, 2);
  const volumeM3 = round(areaM2 * (thicknessMm / 1000), 3);

  return {
    type: 'wall_panel_rebar',
    usageContext,
    wallShape,
    geometry: { planLengthM: round(planLengthM, 2), heightM, thicknessMm, areaM2, volumeM3, layers },
    verticalDevelopmentLengthMm: round(ldVertical, 1),
    ...summary,
    warnings: [],
  };
}
