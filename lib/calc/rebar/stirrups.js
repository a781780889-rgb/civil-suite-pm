// lib/calc/rebar/stirrups.js
// =============================================================================
// مكتبة أشكال الكانات/الأربطة - يُحسب طول كل شكل هندسياً على محور السيخ الفعلي
// (وليس تقريباً) مع طول الخطاف الحقيقي المطابق للقطر والزاوية المختارة.
// =============================================================================

import { hookLengthMm } from './core.js';
import { round } from '../common.js';

export const STIRRUP_SHAPES = {
  rectangular: 'مستطيلة',
  square: 'مربعة',
  circular: 'دائرية',
  polygonal: 'متعددة الأضلاع',
  double: 'مزدوجة (بأشواط إضافية)',
  special: 'خاصة (بمحيط مُدخل يدوياً)',
};

/**
 * يحسب طول كانة واحدة كاملة (شاملة الخطاف) حسب الشكل المختار
 * كل الأبعاد المُدخلة هي أبعاد العنصر الخرساني الخارجية (لا محور السيخ) - يتم اشتقاق
 * أبعاد محور الكانة داخلياً بطرح الغطاء الخرساني وقطر الكانة نفسها.
 */
export function calculateStirrup({
  shape = 'rectangular',
  elementWidthMm,
  elementHeightMm,
  elementDiameterMm,
  sidesCount = 6,
  coverMm = 40,
  stirrupDiaMm = 10,
  hookAngleDeg = 135,
  extraLegsCount = 0,
  specialPerimeterMm = null,
}) {
  const hook = hookLengthMm(stirrupDiaMm, hookAngleDeg, 'stirrup');
  let mainLoopMm = 0;
  let coreWidthMm = null;
  let coreHeightMm = null;

  switch (shape) {
    case 'square': {
      coreWidthMm = elementWidthMm - 2 * coverMm - stirrupDiaMm;
      coreHeightMm = coreWidthMm;
      mainLoopMm = 2 * (coreWidthMm + coreHeightMm);
      break;
    }
    case 'circular': {
      const coreDiaMm = elementDiameterMm - 2 * coverMm - stirrupDiaMm;
      mainLoopMm = Math.PI * coreDiaMm;
      coreWidthMm = coreDiaMm;
      coreHeightMm = coreDiaMm;
      break;
    }
    case 'polygonal': {
      const coreDiaMm = elementDiameterMm - 2 * coverMm - stirrupDiaMm; // دائرة محيطة بالمضلع
      const sideLenMm = coreDiaMm * Math.sin(Math.PI / sidesCount); // طول ضلع مضلع منتظم محاط بدائرة قطرها coreDiaMm
      mainLoopMm = sidesCount * sideLenMm;
      coreWidthMm = sideLenMm;
      coreHeightMm = sideLenMm;
      break;
    }
    case 'special': {
      mainLoopMm = specialPerimeterMm || 0;
      break;
    }
    case 'double':
    case 'rectangular':
    default: {
      coreWidthMm = elementWidthMm - 2 * coverMm - stirrupDiaMm;
      coreHeightMm = elementHeightMm - 2 * coverMm - stirrupDiaMm;
      mainLoopMm = 2 * (coreWidthMm + coreHeightMm);
      break;
    }
  }

  const mainStirrupLengthMm = round(mainLoopMm + hook, 1);

  // الأشواط الإضافية (Cross-ties) للكانات المزدوجة/متعددة الأشواط: سيخ مستقيم بخطافين على الطرفين
  // يمتد عبر البعد الداخلي (نفترض الاتجاه الأقصر ما لم يُحدَّد خلاف ذلك)
  const crossTieSpanMm = coreWidthMm && coreHeightMm ? Math.min(coreWidthMm, coreHeightMm) : 0;
  const crossTieLengthMm = round(crossTieSpanMm + 2 * hook, 1);

  return {
    shape,
    shapeLabel: STIRRUP_SHAPES[shape] || shape,
    hookAngleDeg,
    hookLengthMm: hook,
    coreWidthMm: coreWidthMm != null ? round(coreWidthMm, 1) : null,
    coreHeightMm: coreHeightMm != null ? round(coreHeightMm, 1) : null,
    mainStirrupLengthMm,
    extraLegsCount,
    crossTieLengthMm: extraLegsCount > 0 ? crossTieLengthMm : 0,
    totalLengthPerSetMm: round(mainStirrupLengthMm + extraLegsCount * crossTieLengthMm, 1),
    legsPerSet: 2 + extraLegsCount, // شوطان أساسيان من الكانة الرئيسية + الأشواط الإضافية
  };
}
