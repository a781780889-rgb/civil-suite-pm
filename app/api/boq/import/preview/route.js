// app/api/boq/import/preview/route.js
// يقرأ الملف المرفوع فقط ويُعيد معاينة (صفوف صالحة/مرفوضة مع السبب، أو ملخص طبقات/كيانات
// لـ DXF/IFC التي تحتاج تعييناً يدوياً للأصناف قبل الاستيراد الفعلي) - لا يكتب أي شيء في
// قاعدة البيانات في هذه الخطوة، تماماً كما تشترط قواعد الاستيراد (معاينة قبل الاعتماد).
import { NextResponse } from 'next/server';
import { parseCsvBoqImport } from '@/lib/boq/importers/csv.js';
import { parseExcelBoqImport } from '@/lib/boq/importers/excel.js';
import { parseDxfFile, summarizeDxfLayers } from '@/lib/boq/importers/dxf.js';
import { parseIfcFile, extractIfcElements, summarizeIfcElements } from '@/lib/boq/importers/ifc.js';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ success: false, errors: ['لم يُرفَع أي ملف.'] }, { status: 400 });
    }
    const fileName = file.name || 'upload';
    const ext = (fileName.split('.').pop() || '').toLowerCase();

    if (ext === 'csv') {
      const text = Buffer.from(await file.arrayBuffer()).toString('utf-8');
      return NextResponse.json({ success: true, kind: 'rows', fileName, fileType: 'csv', ...parseCsvBoqImport(text) });
    }
    if (ext === 'xlsx' || ext === 'xls') {
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await parseExcelBoqImport(buffer);
      return NextResponse.json({ success: true, kind: 'rows', fileName, fileType: 'excel', ...result });
    }
    if (ext === 'dxf') {
      const text = Buffer.from(await file.arrayBuffer()).toString('utf-8');
      const unitScale = Number(formData.get('unitScale')) || 0.001;
      const summary = summarizeDxfLayers(parseDxfFile(text), { unitScale });
      return NextResponse.json({ success: true, kind: 'dxf_layers', fileName, fileType: 'dxf', unitScaleUsed: unitScale, ...summary });
    }
    if (ext === 'ifc') {
      const text = Buffer.from(await file.arrayBuffer()).toString('utf-8');
      const elements = extractIfcElements(parseIfcFile(text));
      return NextResponse.json({ success: true, kind: 'ifc_elements', fileName, fileType: 'ifc', elements, summary: summarizeIfcElements(elements) });
    }
    if (ext === 'dwg') {
      return NextResponse.json(
        { success: false, errors: ['صيغة DWG الثنائية غير مدعومة مباشرة (تتطلب مكتبة تحويل مملوكة). يرجى تصدير الملف بصيغة DXF من برنامج الرسم (Save As → DXF) ثم رفعه هنا.'] },
        { status: 400 }
      );
    }
    if (ext === 'pdf') {
      return NextResponse.json(
        { success: false, errors: ['استيراد PDF غير متوفر في هذا الإصدار لعدم موثوقية استخراج الجداول من تخطيطات PDF المتفاوتة. يرجى استخدام Excel أو CSV (النموذج متاح للتنزيل) أو DXF/IFC للمخططات.'] },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: false, errors: [`صيغة ملف غير مدعومة: .${ext}`] }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, errors: [err.message || 'تعذّرت معالجة الملف.'] }, { status: 500 });
  }
}
