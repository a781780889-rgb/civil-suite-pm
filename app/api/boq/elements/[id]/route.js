// app/api/boq/elements/[id]/route.js
import { NextResponse } from 'next/server';
import { getBoqElement, getBoqCategory, getCalculation, updateBoqElement, deleteBoqElement, listBoqAuditLog } from '@/lib/db.js';
import { resolveBoqQuantity } from '@/lib/boq/calcElement.js';
import { calculateElementCost } from '@/lib/boq/pricing.js';
import { ValidationError } from '@/lib/calc/common.js';

export async function GET(request, { params }) {
  const { id } = await params;
  const element = getBoqElement(id);
  if (!element) return NextResponse.json({ success: false, errors: ['العنصر غير موجود.'] }, { status: 404 });
  const auditLog = listBoqAuditLog({ element_id: id, limit: 20 });
  return NextResponse.json({ success: true, element, auditLog });
}

export async function PUT(request, { params }) {
  const { id } = await params;
  try {
    const existing = getBoqElement(id);
    if (!existing) return NextResponse.json({ success: false, errors: ['العنصر غير موجود.'] }, { status: 404 });

    const body = await request.json();
    const categoryKey = body.category_key || existing.category_key;
    const category = getBoqCategory(categoryKey);
    if (!category) return NextResponse.json({ success: false, errors: [`صنف غير معروف: ${categoryKey}`] }, { status: 400 });

    const dimensions = body.dimensions || existing.dimensions;
    const quantityResult = await resolveBoqQuantity({ category, dimensions, getLinkedCalculation: async (cid) => getCalculation(cid) });
    const cost = calculateElementCost({
      quantityWithWaste: quantityResult.quantityWithWaste,
      unitMaterialPrice: body.unit_material_price ?? existing.unit_material_price,
      unitLaborPrice: body.unit_labor_price ?? existing.unit_labor_price,
      unitEquipmentPrice: body.unit_equipment_price ?? existing.unit_equipment_price,
      unitTransportPrice: body.unit_transport_price ?? existing.unit_transport_price,
      taxPct: body.tax_pct ?? existing.tax_pct,
      discountPct: body.discount_pct ?? existing.discount_pct,
    });

    const updated = updateBoqElement(id, {
      category_key: categoryKey,
      linked_calculation_id: quantityResult.linkedCalculationId ?? null,
      name: body.name ?? existing.name,
      location_note: body.location_note ?? existing.location_note,
      dimensions,
      quantity: quantityResult.netQuantity,
      unit: quantityResult.unit,
      waste_pct: quantityResult.wastePct,
      quantity_with_waste: quantityResult.quantityWithWaste,
      unit_material_price: body.unit_material_price ?? existing.unit_material_price,
      unit_labor_price: body.unit_labor_price ?? existing.unit_labor_price,
      unit_equipment_price: body.unit_equipment_price ?? existing.unit_equipment_price,
      unit_transport_price: body.unit_transport_price ?? existing.unit_transport_price,
      tax_pct: body.tax_pct ?? existing.tax_pct,
      discount_pct: body.discount_pct ?? existing.discount_pct,
      total_cost: cost.finalCost,
      materials: quantityResult.materials,
      status: body.status ?? existing.status,
      notes: body.notes ?? existing.notes,
      actor: body.actor || null,
    });

    return NextResponse.json({ success: true, element: updated, quantity: quantityResult, cost });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ success: false, errors: [err.message] }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ success: false, errors: [err.message || 'تعذّر تحديث العنصر.'] }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  try {
    const result = deleteBoqElement(id);
    if (!result.deleted) return NextResponse.json({ success: false, errors: ['العنصر غير موجود.'] }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, errors: ['تعذّر حذف العنصر.'] }, { status: 500 });
  }
}
