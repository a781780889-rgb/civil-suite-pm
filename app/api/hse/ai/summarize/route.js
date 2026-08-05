import { NextResponse } from 'next/server';
import { summarizeSafetyReport } from '@/lib/hse/ai.js';
import { getHseDashboard } from '@/lib/hse/db/dashboard.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { actor_role } = getActor(body, request);
    assertPermission(actor_role, 'hse_risk', 'view');
    const project_id = body.project_id ? Number(body.project_id) : undefined;
    const dashboard = getHseDashboard({ project_id });
    const result = await summarizeSafetyReport({ project_id, dashboard });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return handleHseError(err);
  }
}
