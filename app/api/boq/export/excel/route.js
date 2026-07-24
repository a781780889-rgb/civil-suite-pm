// app/api/boq/export/excel/route.js
import { NextResponse } from 'next/server';
import { listAllBoqElementsForExport, getProject } from '@/lib/db.js';
import { buildBoqExcelReport } from '@/lib/boq/exporters/excel.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id') || undefined;
    const elements = listAllBoqElementsForExport({ project_id: projectId });
    const project = projectId ? getProject(projectId) : null;
    const buffer = await buildBoqExcelReport({ project, elements });
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="boq-report-${projectId || 'all-projects'}.xlsx"`,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, errors: [err.message || 'تعذّر إنشاء تقرير Excel.'] }, { status: 500 });
  }
}
