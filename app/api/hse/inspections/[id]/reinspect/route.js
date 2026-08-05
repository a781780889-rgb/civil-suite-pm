import { NextResponse } from 'next/server';
import { createReinspection } from '@/lib/hse/db/inspections.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'hse_inspection', 'create');
    const inspection = createReinspection(Number(id), body, actor);
    return NextResponse.json({ success: true, inspection }, { status: 201 });
  } catch (err) {
    return handleHseError(err);
  }
}
