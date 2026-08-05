import { NextResponse } from 'next/server';
import { listRisks, createRisk } from '@/lib/hse/db/risks.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError, pageParams } from '@/lib/hse/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_risk', 'view');
    const data = listRisks({
      project_id: searchParams.get('project_id') || undefined, site_id: searchParams.get('site_id') || undefined,
      status: searchParams.get('status') || undefined, risk_level: searchParams.get('risk_level') || undefined,
      category: searchParams.get('category') || undefined, ...pageParams(searchParams),
    });
    return NextResponse.json({ success: true, ...data });
  } catch (err) {
    return handleHseError(err);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'hse_risk', 'create');
    const risk = createRisk(body, actor);
    return NextResponse.json({ success: true, risk }, { status: 201 });
  } catch (err) {
    return handleHseError(err);
  }
}
