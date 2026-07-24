// tests/boq/importers.test.js
// اختبارات حقيقية للمستوردات على عينات بيانات فعلية (لا محاكاة) - تشغيل:
// node --test tests/boq/importers.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';

import { parseCsvBoqImport, generateCsvTemplate } from '../../lib/boq/importers/csv.js';
import { parseExcelBoqImport, generateExcelTemplate } from '../../lib/boq/importers/excel.js';
import { parseDxfFile, summarizeDxfLayers } from '../../lib/boq/importers/dxf.js';
import { parseIfcFile, extractIfcElements, summarizeIfcElements, findIfcQuantityForCategory } from '../../lib/boq/importers/ifc.js';
import { calculateFromPrecomputedQuantity } from '../../lib/boq/calcElement.js';
import { getCategory } from '../../lib/boq/categoryRegistry.js';

describe('استيراد CSV', () => {
  test('يحسب الكمية الصحيحة لصف صالح ويرفض صفاً بصنف غير معروف', () => {
    const csv = [
      'category_key,name,location_note,lengthM,widthM,heightM,count,wastePct',
      'concrete_isolated_footing,قواعد A1-A4,الدور الأرضي,2,2,0.5,4,5',
      'not_a_real_category,عنصر خاطئ,,1,1,1,1,0',
    ].join('\n');
    const result = parseCsvBoqImport(csv);
    assert.equal(result.valid.length, 1);
    assert.equal(result.rejected.length, 1);
    assert.equal(result.valid[0].quantity_with_waste, 8.4); // 2*2*0.5=2 لكل قاعدة × 4 = 8 + هدر5% = 8.4
    assert.match(result.rejected[0].reason, /غير معروف/);
  });

  test('يرفض صفاً بعمود name فارغ', () => {
    const csv = ['category_key,name,areaM2', 'flooring_ceramic,,50'].join('\n');
    const result = parseCsvBoqImport(csv);
    assert.equal(result.valid.length, 0);
    assert.equal(result.rejected.length, 1);
  });

  test('generateCsvTemplate يُنتج رؤوس أعمدة صالحة يمكن قراءتها مباشرة', () => {
    const template = generateCsvTemplate();
    assert.match(template, /category_key/);
    assert.match(template, /wastePct/);
  });
});

describe('استيراد Excel', () => {
  test('يقرأ ملف xlsx حقيقي (مُنشأ بنفس exceljs) ويحسب الكميات بشكل صحيح', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('BOQ');
    sheet.addRow(['category_key', 'name', 'areaM2', 'wastePct']);
    sheet.addRow(['flooring_ceramic', 'أرضية الصالة', 100, 10]);
    sheet.addRow(['masonry_block', 'جدار خارجي', 50, 5]);
    const buffer = await workbook.xlsx.writeBuffer();

    const result = await parseExcelBoqImport(buffer);
    assert.equal(result.valid.length, 2);
    assert.equal(result.rejected.length, 0);
    assert.equal(result.valid[0].quantity_with_waste, 110);
    assert.equal(result.valid[1].quantity_with_waste, 52.5);
  });

  test('generateExcelTemplate يُنتج ملف xlsx صالحاً وقابلاً للقراءة مجدداً', async () => {
    const buffer = await generateExcelTemplate();
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(buffer);
    const headerRow = wb2.worksheets[0].getRow(1).values.filter(Boolean);
    assert.ok(headerRow.includes('category_key'));
  });
});

describe('استيراد DXF', () => {
  const sampleDxf = [
    '0', 'SECTION', '2', 'ENTITIES',
    '0', 'LINE', '8', 'WALLS', '10', '0.0', '20', '0.0', '30', '0.0', '11', '5000.0', '21', '0.0', '31', '0.0',
    '0', 'LWPOLYLINE', '8', 'COLUMNS', '90', '4', '70', '1',
    '10', '0.0', '20', '0.0', '10', '400.0', '20', '0.0', '10', '400.0', '20', '400.0', '10', '0.0', '20', '400.0',
    '0', 'ENDSEC', '0', 'EOF', '',
  ].join('\n');

  test('يحسب الطول الفعلي لخط والمساحة الفعلية لمضلع مغلق، مجمّعَين حسب الطبقة', () => {
    const dxf = parseDxfFile(sampleDxf);
    const summary = summarizeDxfLayers(dxf, { unitScale: 0.001 }); // الرسم بالمليمتر
    const walls = summary.layers.find((l) => l.layer === 'WALLS');
    const columns = summary.layers.find((l) => l.layer === 'COLUMNS');
    assert.equal(walls.lengthM, 5); // 5000مم = 5م
    assert.equal(columns.areaM2, 0.16); // 400×400مم = 0.4×0.4م = 0.16م²
    assert.equal(columns.closedCount, 1);
  });

  test('يرمي خطأً واضحاً عند نص DXF تالف', () => {
    assert.throws(() => parseDxfFile('this is not a dxf file at all'), /DXF/);
  });
});

describe('استيراد IFC', () => {
  // ملف IFC مصغّر يدوياً: جدار واحد (IFCWALL) مرتبط بمجموعة كميات تحوي حجماً ومساحة فعليين
  const sampleIfc = `ISO-10303-21;
HEADER;
ENDSEC;
DATA;
#1=IFCWALL('2O2Fr$t4X7Zf8NOew3FLKp',$,'جدار خارجي W-12','جدار خرساني خارجي 20سم',$,$,$,$,$);
#2=IFCQUANTITYVOLUME('NetVolume',$,$,4.75,$);
#3=IFCQUANTITYAREA('NetSideArea',$,$,19.0,$);
#4=IFCELEMENTQUANTITY('3O2Fr$t4X7Zf8NOew3FLKq',$,'BaseQuantities',$,$,(#2,#3));
#5=IFCRELDEFINESBYPROPERTIES('4O2Fr$t4X7Zf8NOew3FLKr',$,$,$,(#1),#4);
ENDSEC;
END-ISO-10303-21;`;

  test('يستخرج الجدار وكمياته الحقيقية المُصرَّح بها في الملف (لا تخمين)', () => {
    const instances = parseIfcFile(sampleIfc);
    const elements = extractIfcElements(instances);
    assert.equal(elements.length, 1);
    assert.equal(elements[0].ifcType, 'IFCWALL');
    assert.equal(elements[0].name, 'جدار خارجي W-12');
    assert.equal(elements[0].quantities.length, 2);

    const category = getCategory('concrete_wall'); // وحدته m3
    const found = findIfcQuantityForCategory(elements[0], category);
    assert.equal(found.value, 4.75);
    assert.equal(found.quantityName, 'NetVolume');
  });

  test('عنصر بلا مجموعة كميات مرتبطة يُعيد null صراحة (بلا تخمين رقم)', () => {
    const bareIfc = `DATA;\n#1=IFCCOLUMN('guid',$,$,'عمود بلا كميات',$,$,$,$,$);\nENDSEC;`;
    const elements = extractIfcElements(parseIfcFile(bareIfc));
    const category = getCategory('concrete_column_rect');
    assert.equal(findIfcQuantityForCategory(elements[0], category), null);
  });

  test('summarizeIfcElements يجمع حسب نوع الكيان ويقترح صنفاً مبدئياً', () => {
    const instances = parseIfcFile(sampleIfc);
    const summary = summarizeIfcElements(extractIfcElements(instances));
    assert.equal(summary[0].ifcType, 'IFCWALL');
    assert.equal(summary[0].suggestedCategoryKey, 'concrete_wall');
    assert.equal(summary[0].withQuantities, 1);
  });
});

describe('calculateFromPrecomputedQuantity (مسار DXF/IFC بعد الاستخراج)', () => {
  test('يطبّق المضاعِف ونسبة الهدر على كمية جاهزة دون إعادة اشتقاقها هندسياً', () => {
    const category = getCategory('concrete_wall');
    const r = calculateFromPrecomputedQuantity(category, { netQuantity: 4.75, multiplier: 3, wastePct: 5, grade: 'C25' });
    assert.equal(r.withMultiplier, 14.25);
    assert.equal(r.quantityWithWaste, 14.9625);
    assert.ok(r.materials);
  });

  test('يرفض كمية صفرية أو سالبة', () => {
    const category = getCategory('concrete_wall');
    assert.throws(() => calculateFromPrecomputedQuantity(category, { netQuantity: 0 }));
    assert.throws(() => calculateFromPrecomputedQuantity(category, { netQuantity: -5 }));
  });
});
