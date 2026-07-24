import { NextResponse } from 'next/server';
import { generateReportNarrative } from '@/lib/pm/ai.js';
import { handlePmError } from '@/lib/pm/apiHelpers.js';

export async function POST(request) {
  try {
    const body = await request.json();
    if (!body.reportType || !body.data) return NextResponse.json({ success: false, error: 'reportType وdata مطلوبان.' }, { status: 400 });
    const narrative = await generateReportNarrative({ reportType: body.reportType, data: body.data });
    return NextResponse.json({ success: true, narrative });
  } catch (err) {
    return handlePmError(err);
  }
}
