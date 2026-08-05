import { NextResponse } from 'next/server';
import { revokeCertification } from '@/lib/hse/db/training.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const { actor, actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_training', 'approve');
    const certification = revokeCertification(Number(id), actor);
    return NextResponse.json({ success: true, certification });
  } catch (err) {
    return handleHseError(err);
  }
}
