import { NextResponse } from 'next/server';
import { updateBudgetItem, deleteBudgetItem } from '@/lib/pm/db/budget.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'budget', 'edit');
    const item = updateBudgetItem(Number(id), { ...body, actor });
    return NextResponse.json({ success: true, item });
  } catch (err) {
    return handlePmError(err);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'budget', 'delete');
    const result = deleteBudgetItem(Number(id), actor);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return handlePmError(err);
  }
}
