import { NextResponse } from 'next/server';
import { getHseDashboard } from '@/lib/hse/db/dashboard.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_risk', 'view');
    const dashboard = getHseDashboard({
      project_id: searchParams.get('project_id') ? Number(searchParams.get('project_id')) : undefined,
      from: searchParams.get('from') || undefined, to: searchParams.get('to') || undefined,
    });
    return NextResponse.json({ success: true, dashboard });
  } catch (err) {
    return handleHseError(err);
  }
}
