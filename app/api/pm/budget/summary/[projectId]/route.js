import { NextResponse } from 'next/server';
import { getBudgetSummaryForProject, listBudgetItems } from '@/lib/pm/db/budget.js';
import { computeCashFlowByMonth } from '@/lib/pm/budgetCalc.js';
import { handlePmError } from '@/lib/pm/apiHelpers.js';

export async function GET(_request, { params }) {
  try {
    const { projectId } = await params;
    const summary = getBudgetSummaryForProject(Number(projectId));
    const items = listBudgetItems({ project_id: Number(projectId) });
    return NextResponse.json({ success: true, summary, cashFlowByMonth: computeCashFlowByMonth(items) });
  } catch (err) {
    return handlePmError(err);
  }
}
