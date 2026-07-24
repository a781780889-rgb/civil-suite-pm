import { NextResponse } from 'next/server';
import { getPmDashboardStats } from '@/lib/pm/db/dashboard.js';
import { handlePmError } from '@/lib/pm/apiHelpers.js';

export async function GET() {
  try {
    return NextResponse.json({ success: true, ...getPmDashboardStats() });
  } catch (err) {
    return handlePmError(err);
  }
}
