// lib/boq/importers/shared.js
// =============================================================================
// منطق تحقّق وتحويل موحّد لكل واردات حصر الكميات (Excel/CSV بصيغة الأعمدة القياسية).
// أي مستورد (importer) آخر يُعيد صفوفاً بنفس الشكل الوسيط {category_key, name, ...dims}
// يمكنه استدعاء validateAndMapRows مباشرة - هذا ما يبقي csv.js وexcel.js وdxf.js/ifc.js
// متوافقة مع بعضها ومع bulkInsertBoqElements في lib/db.js دون تكرار منطق التحقق أربع مرات.
// =============================================================================

import { getCategory } from '../categoryRegistry.js';
import { calculateGeometryQuantity } from '../calcElement.js';
import { calculateElementCost } from '../pricing.js';
import { ValidationError } from '../../calc/common.js';

export const TEMPLATE_COLUMNS = [
  'category_key', 'name', 'location_note',
  'lengthM', 'widthM', 'heightM', 'diameterM', 'areaM2', 'thicknessM', 'openingsAreaM2',
  'count', 'segments', 'quantityManual', 'wastePct',
  'unit_material_price', 'unit_labor_price', 'unit_equipment_price', 'unit_transport_price',
  'tax_pct', 'discount_pct', 'notes',
];

const NUMERIC_FIELDS = new Set([
  'lengthM', 'widthM', 'heightM', 'diameterM', 'areaM2', 'thicknessM', 'openingsAreaM2',
  'count', 'segments', 'quantityManual', 'wastePct',
  'unit_material_price', 'unit_labor_price', 'unit_equipment_price', 'unit_transport_price', 'tax_pct', 'discount_pct',
]);

function toNumberOrUndefined(v) {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? v : n; // نُبقي القيمة الأصلية إن لم تكن رقماً صالحاً حتى تظهر رسالة خطأ واضحة أدناه
}

/**
 * يحوّل صفوفاً خاماً (من Excel أو CSV، رؤوس أعمدة = TEMPLATE_COLUMNS) إلى صفوف صالحة
 * للإدراج عبر bulkInsertBoqElements، مع رفض الصفوف غير الصالحة وتوضيح السبب لكل واحد
 * (يلبي: "معالجة الأخطاء أثناء الاستيراد دون فقدان البيانات" + تقرير عدد المرفوض وسببه).
 */
export function validateAndMapRows(rawRows) {
  const valid = [];
  const rejected = [];

  rawRows.forEach((raw, idx) => {
    const rowNumber = idx + 2; // +2: صف العناوين + الفهرسة من 1
    try {
      const categoryKey = String(raw.category_key || '').trim();
      if (!categoryKey) throw new ValidationError('العمود category_key فارغ.');
      const category = getCategory(categoryKey);
      if (!category) throw new ValidationError(`مفتاح صنف غير معروف: "${categoryKey}".`);

      const name = String(raw.name || '').trim();
      if (!name) throw new ValidationError('العمود name فارغ.');

      const dimensions = {};
      for (const field of NUMERIC_FIELDS) {
        const val = toNumberOrUndefined(raw[field]);
        if (val !== undefined) dimensions[field] = val;
      }
      for (const field of NUMERIC_FIELDS) {
        if (dimensions[field] !== undefined && typeof dimensions[field] !== 'number') {
          throw new ValidationError(`القيمة في العمود "${field}" ليست رقماً صالحاً.`);
        }
      }

      const quantityResult = calculateGeometryQuantity(category, dimensions);
      const cost = calculateElementCost({
        quantityWithWaste: quantityResult.quantityWithWaste,
        unitMaterialPrice: dimensions.unit_material_price,
        unitLaborPrice: dimensions.unit_labor_price,
        unitEquipmentPrice: dimensions.unit_equipment_price,
        unitTransportPrice: dimensions.unit_transport_price,
        taxPct: dimensions.tax_pct,
        discountPct: dimensions.discount_pct,
      });

      valid.push({
        category_key: categoryKey,
        name,
        location_note: raw.location_note ? String(raw.location_note).trim() : null,
        dimensions,
        quantity: quantityResult.netQuantity,
        unit: quantityResult.unit,
        waste_pct: quantityResult.wastePct,
        quantity_with_waste: quantityResult.quantityWithWaste,
        unit_material_price: dimensions.unit_material_price || 0,
        unit_labor_price: dimensions.unit_labor_price || 0,
        unit_equipment_price: dimensions.unit_equipment_price || 0,
        unit_transport_price: dimensions.unit_transport_price || 0,
        tax_pct: dimensions.tax_pct || 0,
        discount_pct: dimensions.discount_pct || 0,
        total_cost: cost.finalCost,
        materials: quantityResult.materials,
        status: 'confirmed',
        notes: raw.notes ? String(raw.notes).trim() : null,
      });
    } catch (err) {
      rejected.push({ row: rowNumber, data: raw, reason: err.message || 'خطأ غير معروف أثناء معالجة الصف.' });
    }
  });

  return { valid, rejected, totalRows: rawRows.length };
}
