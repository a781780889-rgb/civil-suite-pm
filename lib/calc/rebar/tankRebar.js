// lib/calc/rebar/tankRebar.js
// =============================================================================
// حديد الخزانات (أرضية/علوية) - تركيب من: حديد الجدران (مستقيم/دائري) + القاعدة + السقف
// =============================================================================

import { round } from '../common.js';
import { calculateWallPanelRebar } from './wallPanelRebar.js';
import { calculateSolidSlabRebar } from './slabRebar.js';
import { calculateSteelCost, defaultPriceList } from './core.js';

export function calculateTankRebar(inputs) {
  const {
    tankShape = 'rectangular', // rectangular | circular
    tankPosition = 'ground',
    internalLengthM,
    internalWidthM,
    internalDiameterM,
    heightM,
    wallThicknessMm,
    baseThicknessMm,
    hasRoof = true,
    roofThicknessMm = 150,
    coverMm = 50,
    fcMPa = 30,
    fyMPa = 420,
    wallVertical = { diameterMm: 14, spacingMm: 175 },
    wallHorizontal = { diameterMm: 14, spacingMm: 175 },
    baseBottom = { dir1DiameterMm: 14, dir1SpacingMm: 175, dir2DiameterMm: 14, dir2SpacingMm: 175 },
    roofBottom = { dir1DiameterMm: 10, dir1SpacingMm: 200, dir2DiameterMm: 10, dir2SpacingMm: 200 },
    wastePct = 3,
    priceList,
  } = inputs;

  const wall = calculateWallPanelRebar({
    usageContext: 'tank',
    wallShape: tankShape === 'circular' ? 'circular' : 'straight',
    lengthM: tankShape === 'circular' ? undefined : 2 * (internalLengthM + internalWidthM),
    diameterM: tankShape === 'circular' ? internalDiameterM : undefined,
    heightM,
    thicknessMm: wallThicknessMm,
    coverMm,
    fcMPa,
    fyMPa,
    vertical: wallVertical,
    horizontal: wallHorizontal,
    layers: 2,
    wastePct: 0, // سنطبّق الهدر مرة واحدة على المجموع الكلي في النهاية
    priceList: { steel_price_per_ton: 0, cutting_price_per_ton: 0, bending_price_per_ton: 0, installation_price_per_ton: 0, transport_price_per_ton: 0, tax_pct: 0, discount_pct: 0 },
  });

  const baseLengthM = tankShape === 'circular' ? internalDiameterM + wallThicknessMm / 1000 : internalLengthM + wallThicknessMm / 1000;
  const baseWidthM = tankShape === 'circular' ? internalDiameterM + wallThicknessMm / 1000 : internalWidthM + wallThicknessMm / 1000;

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

  let roof = null;
  if (hasRoof) {
    roof = calculateSolidSlabRebar({
      lengthM: baseLengthM,
      widthM: baseWidthM,
      thicknessMm: roofThicknessMm,
      coverMm,
      fcMPa,
      fyMPa,
      bottom: roofBottom,
      hasTop: false,
      wastePct: 0,
    });
  }

  const allBarGroups = [
    ...wall.barGroups.map((g) => ({ ...g, label: `[جدار] ${g.label}` })),
    ...base.barGroups.map((g) => ({ ...g, label: `[قاعدة] ${g.label}` })),
    ...(roof ? roof.barGroups.map((g) => ({ ...g, label: `[سقف] ${g.label}` })) : []),
  ];

  const totalNetWeightKg = allBarGroups.reduce((s, g) => s + g.weightKg, 0);
  const cost = calculateSteelCost({ netWeightKg: totalNetWeightKg, wastePct, priceList: priceList || defaultPriceList() });
  const totalBarCount = allBarGroups.reduce((s, g) => s + g.count, 0);
  const weightByDiameter = {};
  allBarGroups.forEach((g) => {
    weightByDiameter[g.diameterMm] = round((weightByDiameter[g.diameterMm] || 0) + g.weightKg, 1);
  });

  const totalConcreteVolumeM3 = round(wall.geometry.volumeM3 + base.geometry.volumeM3 + (roof ? roof.geometry.volumeM3 : 0), 3);

  return {
    type: 'tank_rebar',
    tankShape,
    tankPosition,
    wall,
    base,
    roof,
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
