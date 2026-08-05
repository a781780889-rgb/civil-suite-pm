import { NextResponse } from 'next/server';
import { usePart } from '@/lib/equipment/db/spareParts.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleEquipError } from '@/lib/equipment/apiHelpers.js';

export async function POST(request) {
  try {
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'equipment_spare_part', 'edit');
    const result = usePart(body.part_id, body.quantity, {
      maintenance_record_id: body.maintenance_record_id || null, breakdown_id: body.breakdown_id || null,
      used_date: body.used_date, actor,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return handleEquipError(err);
  }
}
