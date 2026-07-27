import { NextResponse } from 'next/server';
import { getBusinessDashboardStats, getBusinessKpis } from '@/lib/business/db/dashboard.js';
import { refreshOverdueCommitments } from '@/lib/business/db/commitments.js';
import { handleBizError } from '@/lib/business/apiHelpers.js';

export async function GET() {
  try {
    refreshOverdueCommitments();
    const stats = getBusinessDashboardStats();
    const kpis = getBusinessKpis();
    return NextResponse.json({ success: true, stats, kpis });
  } catch (err) {
    return handleBizError(err);
  }
}
