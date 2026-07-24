// lib/pm/exporters/csv.js
import Papa from 'papaparse';

/**
 * مُصدِّر CSV عام لأي جدول من جداول القسم الرابع (مهام، ميزانية، مخاطر، موارد، جودة، سلامة...)
 * بدل دالة منفصلة لكل نوع تقرير - نفس مبدأ DRY المُتَّبع في مُصدِّر حصر الكميات.
 * @param {{key:string,label:string}[]} columns
 * @param {object[]} rows
 */
export function buildPmCsv(columns, rows) {
  const data = rows.map((row) => Object.fromEntries(columns.map((c) => [c.label, row[c.key] ?? ''])));
  return Papa.unparse(data);
}
