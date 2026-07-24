// app/api/boq/elements/calculate/route.js
import { NextResponse } from 'next/server';
import { getBoqCategory, getCalculation } from '@/lib/db.js';
import { resolveBoqQuantity } from '@/lib/boq/calcElement.js';
import { calculateElementCost } from '@/lib/boq/pricing.js';
import { ValidationError } from '@/lib/calc/common.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const category = getBoqCategory(body.category_key);
    if (!category) {
      return NextResponse.json({ success: false, errors: [`صنف غير معروف: ${body.category_key}`] }, { status: 400 });
    }

    const quantityResult = await resolveBoqQuantity({
      category,
      dimensions: body.dimensions || {},
      getLinkedCalculation: async (id) => getCalculation(id),
    });

    const cost = calculateElementCost({
      quantityWithWaste: quantityResult.quantityWithWaste,
      unitMaterialPrice: body.unit_material_price,
      unitLaborPrice: body.unit_labor_price,
      unitEquipmentPrice: body.unit_equipment_price,
      unitTransportPrice: body.unit_transport_price,
      taxPct: body.tax_pct,
      discountPct: body.discount_pct,
    });

    return NextResponse.json({ success: true, quantity: quantityResult, cost });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ success: false, errors: [err.message] }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ success: false, errors: [err.message || 'تعذّر تنفيذ الحساب.'] }, { status: 500 });
  }
}
