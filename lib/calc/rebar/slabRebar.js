// lib/calc/rebar/slabRebar.js
// =============================================================================
// محرك تفصيل حديد البلاطات: المصمتة (شبكة باتجاهين) والهوردي (أعصاب + شبكة توزيع في الطبقة العلوية)
// =============================================================================

import { validateNumbers, round } from '../common.js';
import { developmentLengthTensionMm, summarizeBarGroups } from './core.js';

export function calculateSolidSlabRebar(inputs) {
  const {
    lengthM,
    widthM,
    thicknessMm,
    coverMm = 20,
    fcMPa = 25,
    fyMPa = 420,
    bottom = { dir1DiameterMm: 12, dir1SpacingMm: 200, dir2DiameterMm: 12, dir2SpacingMm: 200 },
    hasTop = false,
    top = { dir1DiameterMm: 10, dir1SpacingMm: 250, dir2DiameterMm: 10, dir2SpacingMm: 250 },
    wastePct = 3,
    priceList,
  } = inputs;

  validateNumbers([
    ['الطول', lengthM],
    ['العرض', widthM],
    ['السماكة', thicknessMm],
  ]);

  function dir(label, spanM, otherDimM, diameterMm, spacingMm) {
    const barLengthM = spanM - 2 * (coverMm / 1000) + 2 * 0.15; // امتداد بسيط داخل الكمرات/الحوائط المساندة
    const count = Math.floor((otherDimM * 1000 - 2 * coverMm) / spacingMm) + 1;
    return { label, diameterMm, spacingMm, count: Math.max(count, 2), cuttingLengthM: round(barLengthM, 3) };
  }

  const bottomDir1 = dir('حديد سفلي - الاتجاه الطولي', lengthM, widthM, bottom.dir1DiameterMm, bottom.dir1SpacingMm);
  const bottomDir2 = dir('حديد سفلي - الاتجاه العرضي', widthM, lengthM, bottom.dir2DiameterMm, bottom.dir2SpacingMm);
  const barGroups = [bottomDir1, bottomDir2];

  let topDir1 = null;
  let topDir2 = null;
  if (hasTop) {
    topDir1 = dir('حديد علوي - الاتجاه الطولي', lengthM, widthM, top.dir1DiameterMm, top.dir1SpacingMm);
    topDir2 = dir('حديد علوي - الاتجاه العرضي', widthM, lengthM, top.dir2DiameterMm, top.dir2SpacingMm);
    barGroups.push(topDir1, topDir2);
  }

  const summary = summarizeBarGroups(barGroups, { wastePct, priceList });
  const volumeM3 = round(lengthM * widthM * (thicknessMm / 1000), 3);

  return {
    type: 'solid_slab_rebar',
    geometry: { lengthM, widthM, thicknessMm, areaM2: round(lengthM * widthM, 2), volumeM3 },
    bottom: { dir1: bottomDir1, dir2: bottomDir2 },
    top: hasTop ? { dir1: topDir1, dir2: topDir2 } : null,
    ...summary,
    warnings: [],
  };
}

export function calculateHourdiSlabRebar(inputs) {
  const {
    spanM,
    widthM,
    ribWidthMm = 120,
    blockWidthMm = 400,
    toppingThicknessMm = 50,
    ribDepthMm = 250,
    coverMm = 20,
    fcMPa = 25,
    fyMPa = 420,
    ribBottomBars = { diameterMm: 12, countPerRib: 2 },
    ribHasTopBar = true,
    ribTopBar = { diameterMm: 10, countPerRib: 1 },
    meshDiameterMm = 6,
    meshSpacingMm = 200,
    supportWidthMm = 300,
    wastePct = 3,
    priceList,
  } = inputs;

  validateNumbers([
    ['البحر', spanM],
    ['العرض', widthM],
    ['عرض العصب', ribWidthMm],
    ['عرض البلوك', blockWidthMm],
  ]);

  const ribPitchMm = ribWidthMm + blockWidthMm;
  const ribCount = Math.ceil((widthM * 1000) / ribPitchMm);

  const cbMm = coverMm + ribBottomBars.diameterMm / 2;
  const ldBottom = developmentLengthTensionMm({ dbMm: ribBottomBars.diameterMm, fcMPa, fyMPa, cbMm, isTopBar: false });
  const embedmentM = Math.min(supportWidthMm - coverMm, ldBottom) / 1000;
  const ribBarLengthM = spanM + 2 * embedmentM;

  const barGroups = [
    {
      label: 'حديد سفلي في الأعصاب',
      diameterMm: ribBottomBars.diameterMm,
      cuttingLengthM: round(ribBarLengthM, 3),
      count: ribCount * ribBottomBars.countPerRib,
    },
  ];

  let topBarInfo = null;
  if (ribHasTopBar) {
    topBarInfo = {
      label: 'حديد علوي في الأعصاب (فوق المساند)',
      diameterMm: ribTopBar.diameterMm,
      cuttingLengthM: round(spanM * 0.3 + 2 * 0.3, 3), // امتداد نمطي فوق المسند (~0.3L من كل جهة) - قابل للتعديل حسب مخطط التسليح الفعلي
      count: ribCount * ribTopBar.countPerRib,
    };
    barGroups.push(topBarInfo);
  }

  const meshAreaM2 = round(spanM * widthM, 2);
  const meshCountEachDir = Math.floor((widthM * 1000) / meshSpacingMm) + 1;
  const meshBarLengthM = round(spanM, 2);
  barGroups.push({
    label: 'شبكة التوزيع/الحرارة في الطبقة العلوية',
    diameterMm: meshDiameterMm,
    cuttingLengthM: meshBarLengthM,
    count: meshCountEachDir,
  });

  const summary = summarizeBarGroups(barGroups, { wastePct, priceList });

  const concreteVolumeM3 = round(
    ribCount * (ribWidthMm / 1000) * (ribDepthMm / 1000) * spanM + spanM * widthM * (toppingThicknessMm / 1000),
    3
  );
  const hollowBlocksNeeded = Math.ceil(ribCount * (spanM / 0.4)); // بمقاس بلوك طولي نمطي 40 سم - للاسترشاد الكمي فقط

  return {
    type: 'hourdi_slab_rebar',
    geometry: { spanM, widthM, ribCount, ribPitchMm: round(ribPitchMm, 0), ribDepthMm, toppingThicknessMm, meshAreaM2, concreteVolumeM3 },
    ribBottom: barGroups[0],
    ribTop: topBarInfo,
    mesh: { diameterMm: meshDiameterMm, spacingMm: meshSpacingMm, countEachDirection: meshCountEachDir },
    hollowBlocksNeeded,
    ...summary,
    warnings: [],
  };
}
