// app/api/calculations/[id]/route.js
import { NextResponse } from 'next/server';
import { getCalculation, deleteCalculation, formatReportNumber } from '@/lib/db.js';

export async function GET(request, { params }) {
  const { id } = await params;
  const calc = getCalculation(id);
  if (!calc) {
    return NextResponse.json({ success: false, errors: ['لم يتم العثور على الحساب.'] }, { status: 404 });
  }
  return NextResponse.json({ success: true, calculation: { ...calc, reportNumber: formatReportNumber(calc) } });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  try {
    deleteCalculation(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, errors: ['تعذّر حذف الحساب.'] }, { status: 500 });
  }
}
