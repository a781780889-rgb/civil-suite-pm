// app/api/boq/prices/[id]/route.js
import { NextResponse } from 'next/server';
import { getBoqPriceItem, upsertBoqPriceItem, deleteBoqPriceItem } from '@/lib/db.js';

export async function PUT(request, { params }) {
  const { id } = await params;
  try {
    const existing = getBoqPriceItem(id);
    if (!existing) return NextResponse.json({ success: false, errors: ['بند السعر غير موجود.'] }, { status: 404 });
    const body = await request.json();
    const item = upsertBoqPriceItem({ ...existing, ...body, id: Number(id) });
    return NextResponse.json({ success: true, item });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, errors: [err.message || 'تعذّر تحديث بند السعر.'] }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  try {
    deleteBoqPriceItem(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, errors: ['تعذّر حذف بند السعر.'] }, { status: 500 });
  }
}
