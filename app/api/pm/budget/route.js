import { NextResponse } from 'next/server';
import { listBudgetItems, createBudgetItem } from '@/lib/pm/db/budget.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    if (!projectId) return NextResponse.json({ success: false, error: 'project_id مطلوب.' }, { status: 400 });
    const items = listBudgetItems({
      project_id: Number(projectId), item_type: searchParams.get('item_type') || undefined,
      from: searchParams.get('from') || undefined, to: searchParams.get('to') || undefined,
    });
    return NextResponse.json({ success: true, items });
  } catch (err) {
    return handlePmError(err);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'budget', 'create');
    if (!body.project_id || !body.item_type || !body.amount) {
      return NextResponse.json({ success: false, error: 'project_id ونوع البند والمبلغ مطلوبة.' }, { status: 400 });
    }
    const item = createBudgetItem({ ...body, actor });
    return NextResponse.json({ success: true, item }, { status: 201 });
  } catch (err) {
    return handlePmError(err);
  }
}
