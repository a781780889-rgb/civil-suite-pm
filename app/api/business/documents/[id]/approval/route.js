import { NextResponse } from 'next/server';
import { decideDocumentApproval } from '@/lib/business/db/documents.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleBizError } from '@/lib/business/apiHelpers.js';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'document', 'approve');
    const updated = decideDocumentApproval(id, { approved: body.approved !== false, actor });
    return NextResponse.json({ success: true, document: updated });
  } catch (err) {
    return handleBizError(err);
  }
}
