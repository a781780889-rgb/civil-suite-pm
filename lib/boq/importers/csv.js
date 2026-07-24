// lib/boq/importers/csv.js
import Papa from 'papaparse';
import { validateAndMapRows, TEMPLATE_COLUMNS } from './shared.js';

/** يفكّك نص CSV (بأي ترميز أسطر، فواصل مقتبَسة، إلخ عبر papaparse) إلى صفوف صالحة/مرفوضة */
export function parseCsvBoqImport(csvText) {
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() });
  if (parsed.errors?.length) {
    const fatal = parsed.errors.filter((e) => e.type !== 'FieldMismatch');
    if (fatal.length && (!parsed.data || parsed.data.length === 0)) {
      return { valid: [], rejected: [{ row: 0, data: null, reason: `تعذّر قراءة ملف CSV: ${fatal[0].message}` }], totalRows: 0 };
    }
  }
  return validateAndMapRows(parsed.data);
}

/** ملف CSV نموذجي (Template) بنفس أعمدة الاستيراد - لتنزيله وتعبئته مباشرة */
export function generateCsvTemplate() {
  return Papa.unparse({ fields: TEMPLATE_COLUMNS, data: [] });
}
