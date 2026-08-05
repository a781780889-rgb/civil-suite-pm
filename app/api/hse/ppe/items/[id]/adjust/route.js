import { NextResponse } from 'next/server';
import { adjustPpeStock } from '@/lib/hse/db/ppe.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'hse_ppe', 'edit');
    const item = adjustPpeStock(Number(id), Number(body.delta), actor, body.note);
    return NextResponse.json({ success: true, item });
  } catch (err) {
    return handleHseError(err);
  }
}
