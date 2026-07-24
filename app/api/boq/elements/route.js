// app/api/boq/elements/route.js
import { NextResponse } from 'next/server';
import { listBoqElements, getBoqCategory, getCalculation, findDuplicateBoqElement, createBoqElement } from '@/lib/db.js';
import { resolveBoqQuantity } from '@/lib/boq/calcElement.js';
import { calculateElementCost } from '@/lib/boq/pricing.js';
import { ValidationError } from '@/lib/calc/common.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const result = listBoqElements({
      project_id: searchParams.get('project_id') || undefined,
      trade: searchParams.get('trade') || undefined,
      category_key: searchParams.get('category_key') || undefined,
      status: searchParams.get('status') || undefined,
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') || 1,
      pageSize: searchParams.get('pageSize') || 50,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, errors: ['تعذّر تحميل عناصر حصر الكميات.'] }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (!body.name || !String(body.name).trim()) {
      return NextResponse.json({ success: false, errors: ['اسم العنصر مطلوب.'] }, { status: 400 });
    }
    const category = getBoqCategory(body.category_key);
    if (!category) {
      return NextResponse.json({ success: false, errors: [`صنف غير معروف: ${body.category_key}`] }, { status: 400 });
    }

    if (!body.allowDuplicate) {
      const dup = findDuplicateBoqElement({
        project_id: body.project_id || null,
        category_key: body.category_key,
        name: body.name,
        location_note: body.location_note,
      });
      if (dup) {
        return NextResponse.json(
          { success: false, duplicate: true, existing: dup, errors: ['يوجد عنصر بنفس الاسم والصنف والموقع في هذا المشروع بالفعل. أرسل allowDuplicate=true للتأكيد رغم ذلك.'] },
          { status: 409 }
        );
      }
    }

    const dimensions = body.dimensions || {};
    const quantityResult = await resolveBoqQuantity({ category, dimensions, getLinkedCalculation: async (id) => getCalculation(id) });
    const cost = calculateElementCost({
      quantityWithWaste: quantityResult.quantityWithWaste,
      unitMaterialPrice: body.unit_material_price,
      unitLaborPrice: body.unit_labor_price,
      unitEquipmentPrice: body.unit_equipment_price,
      unitTransportPrice: body.unit_transport_price,
      taxPct: body.tax_pct,
      discountPct: body.discount_pct,
    });

    const created = createBoqElement({
      project_id: body.project_id || null,
      category_key: body.category_key,
      linked_calculation_id: quantityResult.linkedCalculationId || null,
      name: body.name,
      location_note: body.location_note,
      dimensions,
      quantity: quantityResult.netQuantity,
      unit: quantityResult.unit,
      waste_pct: quantityResult.wastePct,
      quantity_with_waste: quantityResult.quantityWithWaste,
      unit_material_price: body.unit_material_price || 0,
      unit_labor_price: body.unit_labor_price || 0,
      unit_equipment_price: body.unit_equipment_price || 0,
      unit_transport_price: body.unit_transport_price || 0,
      tax_pct: body.tax_pct || 0,
      discount_pct: body.discount_pct || 0,
      total_cost: cost.finalCost,
      materials: quantityResult.materials,
      source: body.source || 'manual',
      source_ref: body.source_ref || null,
      status: body.status || 'confirmed',
      notes: body.notes || null,
      actor: body.actor || null,
    });

    return NextResponse.json({ success: true, element: created, quantity: quantityResult, cost }, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ success: false, errors: [err.message] }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ success: false, errors: [err.message || 'تعذّر إنشاء العنصر.'] }, { status: 500 });
  }
}
