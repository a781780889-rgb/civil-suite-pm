import { NextResponse } from 'next/server';
import { reassessRisk } from '@/lib/hse/db/risks.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

/** إعادة تقييم الخطر بعد تطبيق إجراءات التحكم (البند 3). */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'hse_risk', 'edit');
    const risk = reassessRisk(Number(id), body, actor);
    return NextResponse.json({ success: true, risk });
  } catch (err) {
    return handleHseError(err);
  }
}
