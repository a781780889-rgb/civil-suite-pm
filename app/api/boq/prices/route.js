// app/api/boq/prices/route.js
import { NextResponse } from 'next/server';
import { listBoqPriceItems, upsertBoqPriceItem } from '@/lib/db.js';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const items = listBoqPriceItems({ project_id: searchParams.get('project_id') || undefined });
  return NextResponse.json({ success: true, items });
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (!body.item_name || !String(body.item_name).trim()) {
      return NextResponse.json({ success: false, errors: ['اسم البند مطلوب.'] }, { status: 400 });
    }
    const item = upsertBoqPriceItem(body);
    return NextResponse.json({ success: true, item }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, errors: [err.message || 'تعذّر إنشاء بند السعر.'] }, { status: 500 });
  }
}
