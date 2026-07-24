// app/api/boq/import/confirm/route.js
import { NextResponse } from 'next/server';
import { bulkInsertBoqElements, createBoqImportLog } from '@/lib/db.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) {
      return NextResponse.json({ success: false, errors: ['لا توجد صفوف صالحة للاستيراد. عاين الملف أولاً.'] }, { status: 400 });
    }
    const { inserted, skipped } = bulkInsertBoqElements(body.project_id || null, rows, {
      source: body.source || 'import',
      sourceRef: body.fileName || null,
      allowDuplicates: !!body.allowDuplicates,
      actor: body.actor || null,
    });
    const importLog = createBoqImportLog({
      project_id: body.project_id || null,
      file_name: body.fileName || null,
      file_type: body.fileType || 'unknown',
      total_rows: rows.length + (body.preRejectedCount || 0),
      imported_count: inserted.length,
      rejected_count: skipped.length + (body.preRejectedCount || 0),
      rejected: [...(body.preRejected || []), ...skipped],
    });
    return NextResponse.json({ success: true, importedCount: inserted.length, inserted, skipped, importLog });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, errors: [err.message || 'تعذّر إتمام الاستيراد.'] }, { status: 500 });
  }
}
