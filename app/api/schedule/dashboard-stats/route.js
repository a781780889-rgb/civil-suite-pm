import { NextResponse } from 'next/server';
import { getScheduleDashboardStats } from '@/lib/schedule/db/dashboard.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';
import { assertPermission } from '@/lib/pm/roles.js';

export async function GET(request) {
  try {
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'schedule', 'view');
    const stats = getScheduleDashboardStats();
    return NextResponse.json({ success: true, stats });
  } catch (err) {
    return handlePmError(err);
  }
}
