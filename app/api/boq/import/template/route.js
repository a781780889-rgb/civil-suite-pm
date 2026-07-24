// app/api/boq/import/template/route.js
import { NextResponse } from 'next/server';
import { generateCsvTemplate } from '@/lib/boq/importers/csv.js';
import { generateExcelTemplate } from '@/lib/boq/importers/excel.js';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'excel';

  if (format === 'csv') {
    return new NextResponse(generateCsvTemplate(), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="boq-import-template.csv"' },
    });
  }
  const buffer = await generateExcelTemplate();
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="boq-import-template.xlsx"',
    },
  });
}
