// app/api/dashboard-stats/route.js
import { NextResponse } from 'next/server';
import { getDashboardStats } from '@/lib/db.js';

export async function GET() {
  try {
    const stats = getDashboardStats();
    return NextResponse.json({ success: true, stats });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, errors: ['تعذّر جلب إحصائيات لوحة التحكم.'] }, { status: 500 });
  }
}
