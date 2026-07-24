import { NextResponse } from 'next/server';
import { setDocumentApproval } from '@/lib/pm/db/documents.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'document', 'approve');
    const document = setDocumentApproval(Number(id), { approved: !!body.approved, approved_by: actor, notes: body.notes, actor });
    return NextResponse.json({ success: true, document });
  } catch (err) {
    return handlePmError(err);
  }
}
