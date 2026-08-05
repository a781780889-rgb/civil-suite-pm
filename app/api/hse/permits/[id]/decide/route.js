import { NextResponse } from 'next/server';
import { decidePermit } from '@/lib/hse/db/permits.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

/** decision: 'approved' | 'rejected'. الاعتماد النهائي (approve) وليس edit - يتطلبه فقط من
 * يملك approve=true على hse_permit (hse_manager/project_manager حسب مصفوفة الصلاحيات). */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'hse_permit', 'approve');
    const permit = decidePermit(Number(id), body, actor, actor_role);
    return NextResponse.json({ success: true, permit });
  } catch (err) {
    return handleHseError(err);
  }
}
