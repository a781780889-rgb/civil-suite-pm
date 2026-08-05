import { NextResponse } from 'next/server';
import { approveReturnToService } from '@/lib/equipment/db/inspections.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleEquipError } from '@/lib/equipment/apiHelpers.js';

/** اعتماد إعادة تشغيل معدة أُخرجت من الخدمة لسبب سلامة - يتطلب صلاحية "اعتماد" على وحدة السلامة (البند 15). */
export async function POST(request) {
  try {
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'safety', 'approve');
    const equipment = approveReturnToService(body.equipment_id, body.note, actor);
    return NextResponse.json({ success: true, equipment });
  } catch (err) {
    return handleEquipError(err);
  }
}
