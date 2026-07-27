import { NextResponse } from 'next/server';
import { listBizAuditLog } from '@/lib/business/db/audit.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleBizError } from '@/lib/business/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'report', 'view');
    const log = listBizAuditLog({
      entity_type: searchParams.get('entity_type') || undefined,
      entity_id: searchParams.get('entity_id') || undefined,
      limit: Number(searchParams.get('limit')) || 200,
    });
    return NextResponse.json({ success: true, log });
  } catch (err) {
    return handleBizError(err);
  }
}
