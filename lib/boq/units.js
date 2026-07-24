// lib/boq/units.js
// =============================================================================
// تحويل الوحدات لقسم حصر الكميات - يدعم النظامين المتري (SI) والإمبراطوري.
// كل التحويلات تمر عبر وحدة SI مرجعية (canonical) لكل نوع قياس، حتى لا نحتاج
// معامل تحويل مباشر بين كل زوج وحدات - وهذا يضمن دقة رياضية ثابتة ولا يتراكم فيه خطأ تقريب.
// =============================================================================

export const UNIT_DIMENSIONS = {
  length: { canonical: 'm', units: { m: 1, cm: 0.01, mm: 0.001, ft: 0.3048, in: 0.0254 } },
  area: { canonical: 'm2', units: { m2: 1, ft2: 0.09290304 } },
  volume: { canonical: 'm3', units: { m3: 1, ft3: 0.028316846592, l: 0.001 } },
  weight: { canonical: 'kg', units: { kg: 1, ton: 1000, lb: 0.45359237 } },
  count: { canonical: 'ea', units: { ea: 1 } },
};

const UNIT_TO_DIMENSION = Object.fromEntries(
  Object.entries(UNIT_DIMENSIONS).flatMap(([dim, def]) => Object.keys(def.units).map((u) => [u, dim]))
);

export function dimensionOfUnit(unit) {
  return UNIT_TO_DIMENSION[unit] || null;
}

/** يحوّل قيمة من وحدة إلى أخرى ضمن نفس نوع القياس (طول/مساحة/حجم/وزن) */
export function convertUnit(value, fromUnit, toUnit) {
  if (fromUnit === toUnit) return value;
  const dim = UNIT_TO_DIMENSION[fromUnit];
  const dimTo = UNIT_TO_DIMENSION[toUnit];
  if (!dim || !dimTo || dim !== dimTo) {
    throw new Error(`لا يمكن التحويل بين وحدتين من نوعين مختلفين: ${fromUnit} → ${toUnit}`);
  }
  const def = UNIT_DIMENSIONS[dim];
  const valueInCanonical = value * def.units[fromUnit];
  return valueInCanonical / def.units[toUnit];
}

// نظام الوحدات المعروض افتراضياً لكل نوع قياس، حسب اختيار المستخدم (Metric أو Imperial)
export const SYSTEM_DEFAULT_UNITS = {
  metric: { length: 'm', area: 'm2', volume: 'm3', weight: 'kg', count: 'ea' },
  imperial: { length: 'ft', area: 'ft2', volume: 'ft3', weight: 'lb', count: 'ea' },
};

export function defaultUnitFor(dimension, system = 'metric') {
  return SYSTEM_DEFAULT_UNITS[system]?.[dimension] || UNIT_DIMENSIONS[dimension]?.canonical;
}

export const UNIT_LABELS_AR = {
  m: 'م', cm: 'سم', mm: 'مم', ft: 'قدم', in: 'بوصة',
  m2: 'م²', ft2: 'قدم²',
  m3: 'م³', ft3: 'قدم³', l: 'لتر',
  kg: 'كغم', ton: 'طن', lb: 'رطل',
  ea: 'عدد',
};
