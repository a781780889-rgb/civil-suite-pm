// lib/calc/rebar/poolRebar.js
// =============================================================================
// حديد المسابح - تركيب من: حديد الجدران (مستقيم/دائري) + حديد القاعدة
// =============================================================================

import { round } from '../common.js';
import { calculateWallPanelRebar } from './wallPanelRebar.js';
import { calculateSolidSlabRebar } from './slabRebar.js';
import { calculateSteelCost, defaultPriceList } from './core.js';

export function calculatePoolRebar(inputs) {
  const {
    poolShape = 'rectangular', // rectangular | circular
    lengthM,
    widthM,
    diameterM,
    maxDepthM,
    wallThicknessMm,
    baseThicknessMm,
    coverMm = 50,
    fcMPa = 30,
    fyMPa = 420,
    wallVertical = { diameterMm: 14, spacingMm: 175 },
    wallHorizontal = { diameterMm: 12, spacingMm: 175 },
    baseBottom = { dir1DiameterMm: 12, dir1SpacingMm: 175, dir2DiameterMm: 12, dir2SpacingMm: 175 },
    wastePct = 3,
    priceList,
  } = inputs;

  const wall = calculateWallPanelRebar({
    usageContext: 'pool',
    wallShape: poolShape === 'circular' ? 'circular' : 'straight',
    lengthM: poolShape === 'circular' ? undefined : 2 * (lengthM + widthM),
    diameterM: poolShape === 'circular' ? diameterM : undefined,
    heightM: maxDepthM,
    thicknessMm: wallThicknessMm,
    coverMm,
    fcMPa,
    fyMPa,
    vertical: wallVertical,
    horizontal: wallHorizontal,
    layers: 2,
    wastePct: 0,
  });

  const baseLengthM = poolShape === 'circular' ? diameterM + wallThicknessMm / 1000 : lengthM + wallThicknessMm / 1000;
  const baseWidthM = poolShape === 'circular' ? diameterM + wallThicknessMm / 1000 : widthM + wallThicknessMm / 1000;

  const base = calculateSolidSlabRebar({
    lengthM: baseLengthM,
    widthM: baseWidthM,
    thicknessMm: baseThicknessMm,
    coverMm,
    fcMPa,
    fyMPa,
    bottom: baseBottom,
    hasTop: false,
    wastePct: 0,
  });

  const allBarGroups = [
    ...wall.barGroups.map((g) => ({ ...g, label: `[جدار] ${g.label}` })),
    ...base.barGroups.map((g) => ({ ...g, label: `[قاعدة] ${g.label}` })),
  ];

  const totalNetWeightKg = allBarGroups.reduce((s, g) => s + g.weightKg, 0);
  const cost = calculateSteelCost({ netWeightKg: totalNetWeightKg, wastePct, priceList: priceList || defaultPriceList() });
  const totalBarCount = allBarGroups.reduce((s, g) => s + g.count, 0);
  const weightByDiameter = {};
  allBarGroups.forEach((g) => {
    weightByDiameter[g.diameterMm] = round((weightByDiameter[g.diameterMm] || 0) + g.weightKg, 1);
  });

  const totalConcreteVolumeM3 = round(wall.geometry.volumeM3 + base.geometry.volumeM3, 3);

  return {
    type: 'pool_rebar',
    poolShape,
    wall,
    base,
    barGroups: allBarGroups,
    totals: {
      totalWeightKg: round(totalNetWeightKg, 1),
      totalWeightTon: round(totalNetWeightKg / 1000, 3),
      totalBarCount,
      wastePct,
      weightByDiameter,
      cost,
    },
    quantities: { totalConcreteVolumeM3 },
    warnings: [],
  };
}
