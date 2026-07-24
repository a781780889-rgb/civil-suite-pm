import { NextResponse } from 'next/server';
import { listComments, addComment } from '@/lib/pm/db/tasks.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';

export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    return NextResponse.json({ success: true, comments: listComments(Number(id)) });
  } catch (err) {
    return handlePmError(err);
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'task', 'edit');
    if (!body.comment) return NextResponse.json({ success: false, error: 'نص التعليق مطلوب.' }, { status: 400 });
    const comment = addComment({ task_id: Number(id), author: body.author || actor, comment: body.comment });
    return NextResponse.json({ success: true, comment }, { status: 201 });
  } catch (err) {
    return handlePmError(err);
  }
}
