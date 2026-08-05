import { NextResponse } from 'next/server';
import { getDashboardStats } from '@/lib/equipment/db/dashboard.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleEquipError } from '@/lib/equipment/apiHelpers.js';

export async function GET(request) {
  try {
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'equipment', 'view');
    const stats = getDashboardStats();
    return NextResponse.json({ success: true, stats });
  } catch (err) {
    return handleEquipError(err);
  }
}
