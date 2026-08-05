import { NextResponse } from 'next/server';
import { listAuditLog } from '@/lib/equipment/db/audit.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleEquipError } from '@/lib/equipment/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'equipment', 'view');
    const data = listAuditLog({
      equipment_id: searchParams.get('equipment_id') || undefined,
      entity_type: searchParams.get('entity_type') || undefined,
      page: searchParams.get('page') || undefined,
      pageSize: searchParams.get('pageSize') || undefined,
    });
    return NextResponse.json({ success: true, ...data });
  } catch (err) {
    return handleEquipError(err);
  }
}
