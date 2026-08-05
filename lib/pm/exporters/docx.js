// lib/pm/exporters/docx.js
// مُصدِّر Word عام حقيقي - يضاف هنا (بجانب excel.js وcsv.js) ليكون متاحاً لإعادة الاستخدام من
// أي قسم لاحق بنفس مبدأ DRY المُتَّبع في مُصدِّري Excel/CSV، تماماً كما أشار قسما الأعمال
// والمعدات صراحة في توثيقهما إلى غياب مُصدِّر Word في المشروع حتى الآن.
//
// يستخدم حزمة `docx` (مضافة إلى package.json من هذا القسم) لإنتاج ملف .docx حقيقي وصالح -
// وليس HTML بامتداد .doc أو أي حيلة شكلية. يدعم الاتجاه من اليمين لليسار (RTL) عبر خاصية
// bidirectional المدعومة فعلياً في تنسيق OOXML نفسه (Word يتولى تشكيل الحروف العربية بصرياً
// عند العرض، تماماً كما يفعل المتصفح مع HTML - بعكس PDF الذي يتطلب تشكيلاً مسبقاً؛ لذلك
// اختار القسم الرابع أصلاً jsPDF+html2canvas للـ PDF بدل مكتبة PDF خادمية، بينما Word هنا لا
// يعاني هذه المشكلة إطلاقاً فاستُخدمت مكتبة OOXML حقيقية مباشرة).
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, WidthType, BorderStyle,
} from 'docx';

function rtlPara(children, opts = {}) {
  return new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, ...opts, children });
}

function headerCell(text) {
  return new TableCell({
    shading: { fill: 'E8ECF3' },
    children: [rtlPara([new TextRun({ text, bold: true })])],
  });
}

function bodyCell(text) {
  return new TableCell({ children: [rtlPara([new TextRun(String(text ?? ''))])] });
}

/**
 * يبني تقرير Word احترافياً: عنوان + وصف اختياري + جدول بيانات - نفس واجهة buildPmExcel/buildPmCsv
 * (columns: [{key,label}], rows: object[]) حتى يستدعيها أي مسار تصدير بلا تمييز عن باقي الصيغ.
 */
export async function buildPmDocx({ title, subtitle, columns, rows, generatedAt, generatedBy }) {
  const metaLine = [generatedAt ? `تاريخ الإصدار: ${generatedAt}` : null, generatedBy ? `بواسطة: ${generatedBy}` : null]
    .filter(Boolean).join('   |   ');

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: 'B9C2D0' },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: 'B9C2D0' },
      left: { style: BorderStyle.SINGLE, size: 2, color: 'B9C2D0' },
      right: { style: BorderStyle.SINGLE, size: 2, color: 'B9C2D0' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'DCE1E8' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'DCE1E8' },
    },
    rows: [
      new TableRow({ tableHeader: true, children: columns.map((c) => headerCell(c.label)) }),
      ...rows.map((row) => new TableRow({ children: columns.map((c) => bodyCell(row[c.key])) })),
    ],
  });

  const children = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, bidirectional: true, alignment: AlignmentType.RIGHT, children: [new TextRun({ text: title, bold: true })] }),
  ];
  if (subtitle) children.push(rtlPara([new TextRun({ text: subtitle, color: '555555' })]));
  if (metaLine) children.push(rtlPara([new TextRun({ text: metaLine, size: 18, color: '808080' })]));
  children.push(new Paragraph({ text: '' }));
  children.push(table);
  children.push(new Paragraph({ text: '' }));
  children.push(rtlPara([new TextRun({ text: `عدد السجلات: ${rows.length}`, italics: true, size: 18, color: '808080' })]));

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });
  return Packer.toBuffer(doc);
}
