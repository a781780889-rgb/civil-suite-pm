import { NextResponse } from 'next/server';
import { HSE_REPORT_BUILDERS } from '@/lib/hse/reportsData.js';
import { buildPmExcel } from '@/lib/pm/exporters/excel.js';
import { buildPmCsv } from '@/lib/pm/exporters/csv.js';
import { buildPmDocx } from '@/lib/pm/exporters/docx.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';
import { hdb } from '@/lib/hse/schema.js';

// PDF غير مدعوم هنا عمداً: يُصدَّر من الواجهة (lib/pdfExport.js عبر jsPDF+html2canvas) بعد عرض
// الجدول فعلياً في المتصفح - تماماً كباقي الأقسام (1-7) - لتفادي مشاكل تشكيل الحروف العربية
// RTL التي تعاني منها مكتبات PDF الخادمية؛ انظر تعليق الرأس في lib/pm/exporters/docx.js.
export async function GET(request, { params }) {
  try {
    const { type } = await params;
    const { searchParams } = new URL(request.url);
    const { actor, actor_role } = getActor(null, request);
    assertPermission(actor_role, 'report', 'view');
    const builder = HSE_REPORT_BUILDERS[type];
    if (!builder) return NextResponse.json({ success: false, error: `نوع تقرير غير معروف: ${type}` }, { status: 404 });

    const filters = {
      project_id: searchParams.get('project_id') ? Number(searchParams.get('project_id')) : undefined,
      status: searchParams.get('status') || undefined, severity: searchParams.get('severity') || undefined,
      course_id: searchParams.get('course_id') ? Number(searchParams.get('course_id')) : undefined,
      from: searchParams.get('from') || undefined, to: searchParams.get('to') || undefined,
    };
    const { title, columns, rows } = builder(filters);
    const format = searchParams.get('format') || 'json';

    hdb().prepare(`INSERT INTO hse_report_log (project_id, report_type, format, generated_by) VALUES (?, ?, ?, ?)`)
      .run(filters.project_id || null, type, format, actor);

    if (format === 'excel') {
      const buffer = await buildPmExcel(columns, rows, title);
      return new NextResponse(buffer, { headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${title}.xlsx"`,
      } });
    }
    if (format === 'csv') {
      const csv = buildPmCsv(columns, rows);
      return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${title}.csv"` } });
    }
    if (format === 'word' || format === 'docx') {
      const buffer = await buildPmDocx({ title, columns, rows, generatedAt: new Date().toISOString().slice(0, 10), generatedBy: actor });
      return new NextResponse(buffer, { headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${title}.docx"`,
      } });
    }
    return NextResponse.json({ success: true, title, columns, rows });
  } catch (err) {
    return handleHseError(err);
  }
}
