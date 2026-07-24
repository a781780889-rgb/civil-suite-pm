// app/api/rebar-dashboard-stats/route.js
import { NextResponse } from 'next/server';
import { getRebarDashboardStats } from '@/lib/db.js';

export async function GET() {
  try {
    const stats = getRebarDashboardStats();
    return NextResponse.json({ success: true, stats });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, errors: ['تعذّر جلب إحصائيات حديد التسليح.'] }, { status: 500 });
  }
}
