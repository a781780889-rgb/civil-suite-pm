// lib/calc/rebar/padRebar.js
// =============================================================================
// محرك تفصيل حديد العناصر "اللوحية المسطحة": القواعد المنفصلة، المشتركة، اللبشة،
// القبعات الخرسانية، والأساسات الشريطية - شبكة حديد سفلية (وعلوية اختيارية) في اتجاهين
// =============================================================================

import { validateNumbers, round } from '../common.js';
import {
  barUnitWeightKgM,
  developmentLengthTensionMm,
  hookLengthMm,
  summarizeBarGroups,
  REBAR_DIAMETERS_MM,
} from './core.js';

function meshDirection({ label, spanM, otherDimM, coverMm, diameterMm, spacingMm, fcMPa, fyMPa, isTopBar }) {
  const barLengthM = spanM - 2 * (coverMm / 1000);
  const count = Math.floor((otherDimM * 1000 - 2 * coverMm) / spacingMm) + 1;

  const cbMm = Math.min(coverMm + diameterMm / 2, (spacingMm - diameterMm) / 2);
  const ld = developmentLengthTensionMm({ dbMm: diameterMm, fcMPa, fyMPa, cbMm, isTopBar });
  const halfAvailableMm = (barLengthM * 1000) / 2;
  const needsHook = halfAvailableMm < ld;
  const hook = needsHook ? hookLengthMm(diameterMm, 90, 'primary') : 0;
  const cuttingLengthM = barLengthM + (needsHook ? (2 * hook) / 1000 : 0);

  return {
    label,
    diameterMm,
    spacingMm,
    count: Math.max(count, 2),
    cuttingLengthM: round(cuttingLengthM, 3),
    developmentLengthMm: round(ld, 1),
    needsHook,
    note: needsHook ? `أُضيف خطاف 90° عند الطرفين لعدم كفاية طول التثبيت المستقيم المتاح (${round(halfAvailableMm, 0)}mm < ld=${round(ld, 0)}mm)` : 'طول مستقيم كافٍ لتحقيق طول التثبيت دون خطاف',
  };
}

export function calculatePadRebar(inputs) {
  const {
    padType = 'isolated', // isolated | combined | mat | pile_cap | strip_footing
    lengthM,
    widthM,
    thicknessMm,
    coverMm = 75,
    fcMPa = 25,
    fyMPa = 420,
    bottom = { dir1DiameterMm: 16, dir1SpacingMm: 200, dir2DiameterMm: 16, dir2SpacingMm: 200 },
    hasTop = false,
    top = { dir1DiameterMm: 12, dir1SpacingMm: 250, dir2DiameterMm: 12, dir2SpacingMm: 250 },
    dowels = null, // { count, diameterMm, columnHeightM, embedmentIntoFootingM }
    wastePct = 3,
    priceList,
  } = inputs;

  validateNumbers([
    ['الطول', lengthM],
    ['العرض', widthM],
    ['السماكة', thicknessMm],
    ['قطر حديد الاتجاه الأول (سفلي)', bottom.dir1DiameterMm],
    ['تباعد الاتجاه الأول (سفلي)', bottom.dir1SpacingMm],
    ['قطر حديد الاتجاه الثاني (سفلي)', bottom.dir2DiameterMm],
    ['تباعد الاتجاه الثاني (سفلي)', bottom.dir2SpacingMm],
  ]);

  const barGroups = [];

  const bottomDir1 = meshDirection({
    label: 'حديد سفلي - الاتجاه الطولي (L)',
    spanM: lengthM,
    otherDimM: widthM,
    coverMm,
    diameterMm: bottom.dir1DiameterMm,
    spacingMm: bottom.dir1SpacingMm,
    fcMPa,
    fyMPa,
    isTopBar: false,
  });
  const bottomDir2 = meshDirection({
    label: 'حديد سفلي - الاتجاه العرضي (B)',
    spanM: widthM,
    otherDimM: lengthM,
    coverMm,
    diameterMm: bottom.dir2DiameterMm,
    spacingMm: bottom.dir2SpacingMm,
    fcMPa,
    fyMPa,
    isTopBar: false,
  });
  barGroups.push(bottomDir1, bottomDir2);

  let topDir1 = null;
  let topDir2 = null;
  if (hasTop) {
    topDir1 = meshDirection({
      label: 'حديد علوي - الاتجاه الطولي (L)',
      spanM: lengthM,
      otherDimM: widthM,
      coverMm,
      diameterMm: top.dir1DiameterMm,
      spacingMm: top.dir1SpacingMm,
      fcMPa,
      fyMPa,
      isTopBar: true,
    });
    topDir2 = meshDirection({
      label: 'حديد علوي - الاتجاه العرضي (B)',
      spanM: widthM,
      otherDimM: lengthM,
      coverMm,
      diameterMm: top.dir2DiameterMm,
      spacingMm: top.dir2SpacingMm,
      fcMPa,
      fyMPa,
      isTopBar: true,
    });
    barGroups.push(topDir1, topDir2);
  }

  let dowelInfo = null;
  if (dowels && dowels.count > 0) {
    const embedM = dowels.embedmentIntoFootingM || Math.max(thicknessMm / 1000 - coverMm / 1000 - 0.05, 0.3);
    const dowelLengthM = (dowels.columnHeightM || 1) + embedM;
    dowelInfo = { label: 'أوتاد التسليح (Dowels) لربط العمود', diameterMm: dowels.diameterMm, count: dowels.count, cuttingLengthM: round(dowelLengthM, 3) };
    barGroups.push(dowelInfo);
  }

  const summary = summarizeBarGroups(barGroups, { wastePct, priceList });

  const volumeM3 = round(lengthM * widthM * (thicknessMm / 1000), 3);

  return {
    type: 'pad_rebar',
    padType,
    geometry: { lengthM, widthM, thicknessMm, volumeM3 },
    bottom: { dir1: bottomDir1, dir2: bottomDir2 },
    top: hasTop ? { dir1: topDir1, dir2: topDir2 } : null,
    dowels: dowelInfo,
    ...summary,
    warnings: summary.barGroups.filter((g) => g.needsHook).map((g) => `${g.label}: ${g.note}`),
  };
}
