// app/api/prices/route.js
import { NextResponse } from 'next/server';
import { listPriceLists, upsertPriceList } from '@/lib/db.js';

export async function GET() {
  try {
    const rows = listPriceLists();
    return NextResponse.json({ success: true, priceLists: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, errors: ['تعذّر جلب قوائم الأسعار.'] }, { status: 500 });
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, errors: ['طلب غير صالح.'] }, { status: 400 });
  }
  if (!body?.name) {
    return NextResponse.json({ success: false, errors: ['اسم قائمة الأسعار مطلوب.'] }, { status: 422 });
  }
  try {
    const saved = upsertPriceList(body);
    return NextResponse.json({ success: true, priceList: saved });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, errors: ['تعذّر حفظ قائمة الأسعار.'] }, { status: 500 });
  }
}
