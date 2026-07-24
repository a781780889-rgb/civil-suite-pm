import { NextResponse } from 'next/server';
import { getDocument } from '@/lib/pm/db/documents.js';
import { readFileBuffer } from '@/lib/pm/fileStorage.js';
import { handlePmError } from '@/lib/pm/apiHelpers.js';

export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    const document = getDocument(Number(id));
    if (!document) return NextResponse.json({ success: false, error: 'المستند غير موجود.' }, { status: 404 });
    const buffer = readFileBuffer(document.file_path);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': document.mime_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(document.name)}"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (err) {
    if (err.code === 'ENOENT') return NextResponse.json({ success: false, error: 'الملف غير موجود على القرص.' }, { status: 404 });
    return handlePmError(err);
  }
}
