// app/api/boq/export/csv/route.js
import { NextResponse } from 'next/server';
import { listAllBoqElementsForExport } from '@/lib/db.js';
import { buildBoqCsvReport } from '@/lib/boq/exporters/csv.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id') || undefined;
    const elements = listAllBoqElementsForExport({ project_id: projectId });
    const csv = buildBoqCsvReport(elements);
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="boq-report-${projectId || 'all-projects'}.csv"` },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, errors: [err.message || 'تعذّر إنشاء تقرير CSV.'] }, { status: 500 });
  }
}
