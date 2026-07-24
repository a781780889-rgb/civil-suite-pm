// lib/boq/exporters/csv.js
import Papa from 'papaparse';

const COLUMNS = [
  { key: 'category_name_ar', label: 'الصنف' },
  { key: 'name', label: 'الاسم' },
  { key: 'location_note', label: 'الموقع' },
  { key: 'quantity_with_waste', label: 'الكمية شاملة الهدر' },
  { key: 'unit', label: 'الوحدة' },
  { key: 'waste_pct', label: 'نسبة الهدر %' },
  { key: 'unit_material_price', label: 'سعر وحدة المواد' },
  { key: 'unit_labor_price', label: 'سعر وحدة العمالة' },
  { key: 'unit_equipment_price', label: 'سعر وحدة المعدات' },
  { key: 'unit_transport_price', label: 'سعر وحدة النقل' },
  { key: 'total_cost', label: 'التكلفة الإجمالية' },
  { key: 'source', label: 'المصدر' },
  { key: 'status', label: 'الحالة' },
  { key: 'notes', label: 'ملاحظات' },
];

export function buildBoqCsvReport(elements) {
  const rows = elements.map((el) => Object.fromEntries(COLUMNS.map((c) => [c.label, el[c.key] ?? ''])));
  return Papa.unparse(rows);
}
