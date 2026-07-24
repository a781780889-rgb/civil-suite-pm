// lib/boq/exporters/excel.js
import ExcelJS from 'exceljs';
import { TRADES } from '../categoryRegistry.js';
import { UNIT_LABELS_AR } from '../units.js';

const BRAND_NAVY = 'FF16324F';
const BRAND_LIGHT = 'FFEFF3F6';

/**
 * يبني تقرير BOQ كملف Excel احترافي - مُقسَّم حسب التخصص مع مجاميع فرعية لكل تخصص
 * ومجموع كلي، وترويسة تتضمن اسم المشروع وتاريخ إصدار التقرير (يلبي متطلبات "تضمين شعار
 * الشركة وبيانات المشروع" و"تاريخ ووقت إنشاء التقرير" - الشعار نفسه صورة يُدرجها المستخدم،
 * انظر ملاحظة addImage أدناه).
 */
export async function buildBoqExcelReport({ project, elements, generatedAt = new Date(), logoBuffer = null }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Civil Engineering Suite';
  workbook.created = generatedAt;
  const sheet = workbook.addWorksheet('حصر الكميات', { views: [{ rightToLeft: true }] });

  sheet.mergeCells('A1:H1');
  sheet.getCell('A1').value = `تقرير حصر الكميات (BOQ) - ${project?.name || 'بلا مشروع محدد'}`;
  sheet.getCell('A1').font = { bold: true, size: 16, color: { argb: BRAND_NAVY } };
  sheet.mergeCells('A2:H2');
  sheet.getCell('A2').value = `تاريخ الإصدار: ${generatedAt.toISOString().slice(0, 10)}    |    عدد العناصر: ${elements.length}`;
  sheet.getCell('A2').font = { size: 10, color: { argb: 'FF666666' } };

  if (logoBuffer) {
    const imageId = workbook.addImage({ buffer: logoBuffer, extension: 'png' });
    sheet.addImage(imageId, { tl: { col: 6.2, row: 0 }, ext: { width: 90, height: 40 } });
  }

  let row = 4;
  const header = ['م', 'الصنف', 'الوصف/الموقع', 'الوحدة', 'الكمية', 'الهدر %', 'سعر الوحدة', 'التكلفة الإجمالية'];
  const grouped = groupByTrade(elements);
  let grandTotal = 0;
  let seq = 1;

  for (const tradeKey of Object.keys(TRADES).sort((a, b) => TRADES[a].order - TRADES[b].order)) {
    const items = grouped[tradeKey];
    if (!items || !items.length) continue;

    const titleRow = sheet.getRow(row);
    sheet.mergeCells(`A${row}:H${row}`);
    titleRow.getCell(1).value = TRADES[tradeKey].label_ar;
    titleRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_NAVY } };
    row += 1;

    const headerRow = sheet.getRow(row);
    header.forEach((h, i) => { headerRow.getCell(i + 1).value = h; });
    headerRow.font = { bold: true };
    headerRow.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_LIGHT } }; c.border = { bottom: { style: 'thin' } }; });
    row += 1;

    let tradeSubtotal = 0;
    for (const el of items) {
      const r = sheet.getRow(row);
      r.getCell(1).value = seq;
      r.getCell(2).value = el.category_name_ar || el.category_key;
      r.getCell(3).value = [el.name, el.location_note].filter(Boolean).join(' - ');
      r.getCell(4).value = UNIT_LABELS_AR[el.unit] || el.unit;
      r.getCell(5).value = Number(el.quantity_with_waste) || 0;
      r.getCell(6).value = Number(el.waste_pct) || 0;
      r.getCell(7).value = Number(el.unit_material_price) || 0;
      r.getCell(8).value = Number(el.total_cost) || 0;
      tradeSubtotal += Number(el.total_cost) || 0;
      seq += 1; row += 1;
    }

    const subtotalRow = sheet.getRow(row);
    sheet.mergeCells(`A${row}:G${row}`);
    subtotalRow.getCell(1).value = `مجموع ${TRADES[tradeKey].label_ar}`;
    subtotalRow.getCell(1).font = { bold: true };
    subtotalRow.getCell(1).alignment = { horizontal: 'left' };
    subtotalRow.getCell(8).value = tradeSubtotal;
    subtotalRow.getCell(8).font = { bold: true };
    grandTotal += tradeSubtotal;
    row += 2;
  }

  sheet.mergeCells(`A${row}:G${row}`);
  sheet.getCell(`A${row}`).value = 'الإجمالي الكلي للمشروع';
  sheet.getCell(`A${row}`).font = { bold: true, size: 13, color: { argb: BRAND_NAVY } };
  sheet.getCell(`H${row}`).value = grandTotal;
  sheet.getCell(`H${row}`).font = { bold: true, size: 13, color: { argb: BRAND_NAVY } };

  sheet.columns = [{ width: 6 }, { width: 22 }, { width: 30 }, { width: 10 }, { width: 12 }, { width: 10 }, { width: 14 }, { width: 16 }];
  sheet.getColumn(5).numFmt = '#,##0.00';
  sheet.getColumn(7).numFmt = '#,##0.00';
  sheet.getColumn(8).numFmt = '#,##0.00';

  return workbook.xlsx.writeBuffer();
}

function groupByTrade(elements) {
  const byTrade = {};
  for (const el of elements) {
    const t = el.trade || 'other';
    if (!byTrade[t]) byTrade[t] = [];
    byTrade[t].push(el);
  }
  return byTrade;
}
