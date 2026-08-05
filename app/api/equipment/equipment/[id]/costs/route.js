import { NextResponse } from 'next/server';
import { computeEquipmentCostSummary, computeEquipmentUtilization } from '@/lib/equipment/db/costs.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleEquipError } from '@/lib/equipment/apiHelpers.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'equipment', 'view');
    const from = searchParams.get('from') || undefined;
    const to = searchParams.get('to') || undefined;
    const summary = computeEquipmentCostSummary(id, { from, to });
    const utilization = from && to ? computeEquipmentUtilization(id, from, to) : null;
    return NextResponse.json({ success: true, summary, utilization });
  } catch (err) {
    return handleEquipError(err);
  }
}
