import { NextResponse } from 'next/server';
import { REPORT_BUILDERS } from '@/lib/equipment/reportsData.js';
import { buildPmCsv } from '@/lib/pm/exporters/csv.js';
import { buildPmExcelReport } from '@/lib/pm/exporters/excel.js';
import { logReportGeneration } from '@/lib/equipment/db/reports.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleEquipError } from '@/lib/equipment/apiHelpers.js';

export async function GET(request, { params }) {
  try {
    const { type } = await params;
    const builder = REPORT_BUILDERS[type];
    if (!builder) return NextResponse.json({ success: false, error: `نوع تقرير غير معروف: ${type}` }, { status: 400 });
    const { searchParams } = new URL(request.url);
    const { actor } = getActor(null, request);
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'report', 'view');

    const { title, columns, rows } = builder({ from: searchParams.get('from') || undefined, to: searchParams.get('to') || undefined });
    const format = searchParams.get('format') || 'json';
    logReportGeneration({ equipment_id: searchParams.get('equipment_id') ? Number(searchParams.get('equipment_id')) : null, report_type: type, format, generated_by: actor });

    if (format === 'csv') {
      const csv = buildPmCsv(columns, rows);
      return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="equipment-${type}.csv"` } });
    }
    if (format === 'excel') {
      const buffer = await buildPmExcelReport({ title, sections: [{ sectionTitle: title, columns, rows }] });
      return new NextResponse(buffer, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="equipment-${type}.xlsx"` } });
    }
    return NextResponse.json({ success: true, title, columns, rows });
  } catch (err) {
    return handleEquipError(err);
  }
}
