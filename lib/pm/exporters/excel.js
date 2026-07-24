// lib/pm/exporters/excel.js
import ExcelJS from 'exceljs';

const BRAND_NAVY = 'FF16324F';
const BRAND_LIGHT = 'FFEFF3F6';

/**
 * مُصدِّر Excel عام - يبني ورقة عمل واحدة أو أكثر من أقسام (كل قسم: عنوان + أعمدة + صفوف)،
 * يُستخدم لكل تقارير القسم الرابع (بدل ملف منفصل لكل نوع تقرير).
 * @param {{title:string, project?:object, sections:{sectionTitle:string, columns:{key:string,label:string}[], rows:object[]}[]}} spec
 */
export async function buildPmExcelReport({ title, project, generatedAt = new Date(), sections }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Civil Engineering Suite';
  workbook.created = generatedAt;
  const sheet = workbook.addWorksheet(title.slice(0, 28) || 'تقرير', { views: [{ rightToLeft: true }] });

  let row = 1;
  sheet.mergeCells(`A${row}:H${row}`);
  sheet.getCell(`A${row}`).value = `${title}${project?.name ? ' - ' + project.name : ''}`;
  sheet.getCell(`A${row}`).font = { bold: true, size: 16, color: { argb: BRAND_NAVY } };
  row += 1;
  sheet.mergeCells(`A${row}:H${row}`);
  sheet.getCell(`A${row}`).value = `تاريخ الإصدار: ${generatedAt.toISOString().slice(0, 10)}`;
  sheet.getCell(`A${row}`).font = { size: 10, color: { argb: 'FF666666' } };
  row += 2;

  for (const section of sections) {
    if (!section.rows.length) continue;
    sheet.mergeCells(`A${row}:${colLetter(section.columns.length)}${row}`);
    const titleCell = sheet.getCell(`A${row}`);
    titleCell.value = section.sectionTitle;
    titleCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_NAVY } };
    row += 1;

    const headerRow = sheet.getRow(row);
    section.columns.forEach((c, i) => { headerRow.getCell(i + 1).value = c.label; });
    headerRow.font = { bold: true };
    headerRow.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_LIGHT } }; c.border = { bottom: { style: 'thin' } }; });
    row += 1;

    for (const r of section.rows) {
      const dataRow = sheet.getRow(row);
      section.columns.forEach((c, i) => { dataRow.getCell(i + 1).value = r[c.key] ?? ''; });
      row += 1;
    }
    row += 1; // سطر فارغ يفصل الأقسام
  }

  sheet.columns.forEach((col) => { col.width = 20; });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

function colLetter(n) {
  let s = '';
  let num = Math.max(1, n);
  while (num > 0) {
    const rem = (num - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    num = Math.floor((num - 1) / 26);
  }
  return s;
}
