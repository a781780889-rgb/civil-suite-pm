// app/api/calculations/route.js
import { NextResponse } from 'next/server';
import { listCalculations, createCalculation } from '@/lib/db.js';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const calc_type = searchParams.get('calc_type') || undefined;
  const project_id = searchParams.get('project_id') || undefined;
  try {
    const rows = listCalculations({ calc_type, project_id });
    return NextResponse.json({ success: true, calculations: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, errors: ['تعذّر جلب سجل الحسابات.'] }, { status: 500 });
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, errors: ['طلب غير صالح.'] }, { status: 400 });
  }
  if (!body?.calc_type || !body?.inputs || !body?.results) {
    return NextResponse.json({ success: false, errors: ['بيانات الحفظ غير مكتملة.'] }, { status: 422 });
  }
  try {
    const saved = createCalculation(body);
    return NextResponse.json({ success: true, calculation: saved });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, errors: ['تعذّر حفظ الحساب.'] }, { status: 500 });
  }
}
