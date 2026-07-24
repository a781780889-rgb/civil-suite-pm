// app/api/prices/[id]/route.js
import { NextResponse } from 'next/server';
import { deletePriceList } from '@/lib/db.js';

export async function DELETE(request, { params }) {
  const { id } = await params;
  try {
    deletePriceList(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, errors: ['تعذّر حذف قائمة الأسعار.'] }, { status: 500 });
  }
}
