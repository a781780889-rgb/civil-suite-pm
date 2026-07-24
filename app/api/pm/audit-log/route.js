import { NextResponse } from 'next/server';
import { listPmAuditLog } from '@/lib/pm/db/audit.js';
import { handlePmError } from '@/lib/pm/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const log = listPmAuditLog({
      project_id: searchParams.get('project_id') ? Number(searchParams.get('project_id')) : undefined,
      entity_type: searchParams.get('entity_type') || undefined,
      entity_id: searchParams.get('entity_id') ? Number(searchParams.get('entity_id')) : undefined,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
    });
    return NextResponse.json({ success: true, log });
  } catch (err) {
    return handlePmError(err);
  }
}
