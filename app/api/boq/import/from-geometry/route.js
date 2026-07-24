// app/api/boq/import/from-geometry/route.js
// يحوّل عناصر مُستخرجة فعلياً من DXF (طول/مساحة الطبقة) أو IFC (كمية مُصرَّح بها في الملف)
// بعد أن يختار المستخدم لكل منها صنف BOQ مناسب في واجهة المعاينة - إلى نفس شكل {valid,
// rejected} الذي ينتجه استيراد Excel/CSV، ليمر عبر نفس مسار التأكيد (confirm) والتدقيق.
import { NextResponse } from 'next/server';
import { getBoqCategory } from '@/lib/db.js';
import { calculateFromPrecomputedQuantity } from '@/lib/boq/calcElement.js';
import { calculateElementCost } from '@/lib/boq/pricing.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const items = Array.isArray(body.items) ? body.items : [];
    const valid = [];
    const rejected = [];

    items.forEach((item, idx) => {
      try {
        if (!item.category_key) throw new Error('لم يُحدَّد صنف لهذا العنصر.');
        const category = getBoqCategory(item.category_key);
        if (!category) throw new Error(`صنف غير معروف: ${item.category_key}`);
        if (!item.name || !String(item.name).trim()) throw new Error('الاسم مطلوب.');
        if (!(Number(item.netQuantity) > 0)) throw new Error('لا توجد كمية مُستخرجة صالحة لهذا العنصر (راجعه يدوياً).');

        const q = calculateFromPrecomputedQuantity(category, {
          netQuantity: item.netQuantity,
          multiplier: item.multiplier || 1,
          wastePct: item.wastePct,
          grade: item.grade,
          cementType: item.cementType,
        });
        const cost = calculateElementCost({
          quantityWithWaste: q.quantityWithWaste,
          unitMaterialPrice: item.unit_material_price,
          unitLaborPrice: item.unit_labor_price,
          unitEquipmentPrice: item.unit_equipment_price,
          unitTransportPrice: item.unit_transport_price,
          taxPct: item.tax_pct,
          discountPct: item.discount_pct,
        });

        valid.push({
          category_key: item.category_key,
          name: item.name,
          location_note: item.location_note || null,
          dimensions: { sourceGeometry: item.sourceLabel || null, extractedQuantity: item.netQuantity, extractedUnit: category.unit },
          quantity: q.netQuantity,
          unit: q.unit,
          waste_pct: q.wastePct,
          quantity_with_waste: q.quantityWithWaste,
          unit_material_price: item.unit_material_price || 0,
          unit_labor_price: item.unit_labor_price || 0,
          unit_equipment_price: item.unit_equipment_price || 0,
          unit_transport_price: item.unit_transport_price || 0,
          tax_pct: item.tax_pct || 0,
          discount_pct: item.discount_pct || 0,
          total_cost: cost.finalCost,
          materials: q.materials,
          status: 'confirmed',
          notes: item.notes || null,
        });
      } catch (err) {
        rejected.push({ row: idx + 1, data: item, reason: err.message });
      }
    });

    return NextResponse.json({ success: true, kind: 'rows', valid, rejected, totalRows: items.length });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, errors: [err.message || 'تعذّرت معالجة العناصر المُختارة.'] }, { status: 500 });
  }
}
