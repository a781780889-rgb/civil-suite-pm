// app/api/boq/dashboard-stats/route.js
import { NextResponse } from 'next/server';
import { getBoqDashboardStats } from '@/lib/db.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id') || undefined;
    const stats = getBoqDashboardStats(projectId);
    return NextResponse.json({ success: true, stats });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, errors: ['تعذّر تحميل إحصائيات لوحة التحكم.'] }, { status: 500 });
  }
}
