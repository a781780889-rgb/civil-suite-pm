// lib/boq/pricing.js
// =============================================================================
// حساب تكلفة عنصر حصر كميات واحد. يتبع نفس ترتيب التكلفة المعتمد فعلياً في القسم الثاني
// لحديد التسليح (انظر lib/db.js وREADME): تُطبَّق كل بنود التكلفة على الكمية شاملة الهدر
// (quantityWithWaste) وليس الصافية - لأن هذا ما سيُشترى فعلياً - بالترتيب:
//   مواد ← عمالة ← معدات ← نقل  =>  المجموع الفرعي  ← خصم %  ← ضريبة %  => التكلفة النهائية
// =============================================================================

import { round } from '../calc/common.js';

export function calculateElementCost({
  quantityWithWaste,
  unitMaterialPrice = 0,
  unitLaborPrice = 0,
  unitEquipmentPrice = 0,
  unitTransportPrice = 0,
  taxPct = 0,
  discountPct = 0,
}) {
  const qty = Number(quantityWithWaste) || 0;
  const materialCost = qty * (Number(unitMaterialPrice) || 0);
  const laborCost = qty * (Number(unitLaborPrice) || 0);
  const equipmentCost = qty * (Number(unitEquipmentPrice) || 0);
  const transportCost = qty * (Number(unitTransportPrice) || 0);

  const subtotal = materialCost + laborCost + equipmentCost + transportCost;
  const discountAmount = subtotal * ((Number(discountPct) || 0) / 100);
  const afterDiscount = subtotal - discountAmount;
  const taxAmount = afterDiscount * ((Number(taxPct) || 0) / 100);
  const finalCost = afterDiscount + taxAmount;

  return {
    materialCost: round(materialCost, 2),
    laborCost: round(laborCost, 2),
    equipmentCost: round(equipmentCost, 2),
    transportCost: round(transportCost, 2),
    subtotal: round(subtotal, 2),
    discountAmount: round(discountAmount, 2),
    afterDiscount: round(afterDiscount, 2),
    taxAmount: round(taxAmount, 2),
    finalCost: round(finalCost, 2),
  };
}

/** يجمع تكاليف مجموعة عناصر (لتقرير BOQ الكلي أو لوحة التحكم) */
export function summarizeCosts(elements) {
  return elements.reduce(
    (acc, el) => {
      acc.materialCost += el.materialCost || 0;
      acc.laborCost += el.laborCost || 0;
      acc.equipmentCost += el.equipmentCost || 0;
      acc.transportCost += el.transportCost || 0;
      acc.totalCost += el.total_cost || el.finalCost || 0;
      return acc;
    },
    { materialCost: 0, laborCost: 0, equipmentCost: 0, transportCost: 0, totalCost: 0 }
  );
}
