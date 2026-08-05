import { NextResponse } from 'next/server';
import { returnPpe } from '@/lib/hse/db/ppe.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'hse_ppe', 'edit');
    const distribution = returnPpe(Number(id), body, actor);
    return NextResponse.json({ success: true, distribution });
  } catch (err) {
    return handleHseError(err);
  }
}
