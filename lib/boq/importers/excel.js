// lib/boq/importers/excel.js
import ExcelJS from 'exceljs';
import { validateAndMapRows, TEMPLATE_COLUMNS } from './shared.js';

/** يقرأ ملف Excel مرفوع (Buffer) - أول ورقة، الصف الأول عناوين أعمدة تطابق TEMPLATE_COLUMNS */
export async function parseExcelBoqImport(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { valid: [], rejected: [{ row: 0, data: null, reason: 'ملف Excel لا يحتوي أي ورقة عمل.' }], totalRows: 0 };

  const headerRow = sheet.getRow(1);
  const headers = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? '').trim();
  });

  const rawRows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const isEmpty = row.values.length <= 1;
    if (isEmpty) return;
    const obj = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const key = headers[colNumber];
      if (!key) return;
      obj[key] = cell.value != null && typeof cell.value === 'object' && 'result' in cell.value ? cell.value.result : cell.value;
    });
    rawRows.push(obj);
  });

  return validateAndMapRows(rawRows);
}

/** ملف Excel نموذجي (Template) بنفس أعمدة الاستيراد، مع تلوين رأس الجدول بهوية النظام */
export async function generateExcelTemplate() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('BOQ');
  sheet.addRow(TEMPLATE_COLUMNS);
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16324F' } };
  });
  sheet.columns.forEach((col) => { col.width = 18; });
  return workbook.xlsx.writeBuffer();
}
