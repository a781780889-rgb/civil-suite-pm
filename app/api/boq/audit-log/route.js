// app/api/boq/audit-log/route.js
import { NextResponse } from 'next/server';
import { listBoqAuditLog } from '@/lib/db.js';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const auditLog = listBoqAuditLog({
    project_id: searchParams.get('project_id') || undefined,
    element_id: searchParams.get('element_id') || undefined,
    limit: Number(searchParams.get('limit')) || 100,
  });
  return NextResponse.json({ success: true, auditLog });
}
