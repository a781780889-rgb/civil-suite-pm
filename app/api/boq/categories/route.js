// app/api/boq/categories/route.js
import { NextResponse } from 'next/server';
import { listBoqCategories, createCustomBoqCategory } from '@/lib/db.js';
import { TRADES } from '@/lib/boq/categoryRegistry.js';

export async function GET() {
  try {
    const categories = listBoqCategories();
    return NextResponse.json({ success: true, categories, trades: TRADES });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, errors: ['تعذّر تحميل أصناف حصر الكميات.'] }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (!body.name_ar) {
      return NextResponse.json({ success: false, errors: ['اسم الصنف مطلوب.'] }, { status: 400 });
    }
    const category = createCustomBoqCategory(body);
    return NextResponse.json({ success: true, category }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ success: false, errors: [err.message || 'تعذّر إنشاء الصنف المخصص.'] }, { status: 400 });
  }
}
