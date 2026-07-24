// lib/pm/budgetCalc.js
// =============================================================================
// حسابات الميزانية والتكاليف (قاعدة سادساً الإلزامية). بنية Budget / Committed / Actual /
// Change Orders - نفس المبدأ المُتَّبع في أنظمة ضبط التكلفة الهندسية الحقيقية:
//   - budget/contract الأساسيان يأتيان من جدول projects (كما أدخلهما المستخدم عند الإنشاء).
//   - أوامر التغيير (change_order) تُعدّل الميزانية أو قيمة العقد الحاليين (مع سجل تاريخي كامل
//     لأنها صفوف pm_budget_items مستقلة، وليست تعديلاً مباشراً صامتاً على رقم المشروع).
//   - purchase_order = تكلفة مُلتزم بها ولم تُصرف فعلياً بعد (Committed)، منفصلة عن expense
//     الفعلي - تمييز حقيقي بين "مُلتزم به" و"مصروف فعلياً" وليس رقماً واحداً مضلِّلاً.
// =============================================================================

function sumBy(items, type, filterFn) {
  return items
    .filter((i) => i.item_type === type && (!filterFn || filterFn(i)))
    .reduce((s, i) => s + (Number(i.amount) || 0), 0);
}

export function computeBudgetSummary(project, items) {
  const budgetChangeOrders = sumBy(items, 'change_order', (i) => i.category === 'budget');
  const contractChangeOrders = sumBy(items, 'change_order', (i) => i.category === 'contract');

  const currentBudget = (Number(project.budget) || 0) + budgetChangeOrders;
  const currentContractValue = (Number(project.contract_value) || 0) + contractChangeOrders;

  const totalExpenses = sumBy(items, 'expense');
  const totalRevenue = sumBy(items, 'revenue');
  const totalCommitted = sumBy(items, 'purchase_order', (i) => i.status !== 'cancelled' && i.status !== 'closed');

  const spentPct = currentBudget > 0 ? Math.round((totalExpenses / currentBudget) * 10000) / 100 : 0;
  const committedPct = currentBudget > 0 ? Math.round(((totalExpenses + totalCommitted) / currentBudget) * 10000) / 100 : 0;
  const deviation = Math.round((currentBudget - totalExpenses) * 100) / 100;
  const deviationPct = currentBudget > 0 ? Math.round((deviation / currentBudget) * 10000) / 100 : 0;
  const profitLoss = Math.round((totalRevenue - totalExpenses) * 100) / 100;
  const targetProfitAmount = Math.round(currentContractValue * ((Number(project.target_profit_pct) || 0) / 100) * 100) / 100;
  const projectedProfitAtBudget = Math.round((currentContractValue - currentBudget) * 100) / 100;

  return {
    currentBudget: round2(currentBudget),
    currentContractValue: round2(currentContractValue),
    budgetChangeOrders: round2(budgetChangeOrders),
    contractChangeOrders: round2(contractChangeOrders),
    totalExpenses: round2(totalExpenses),
    totalRevenue: round2(totalRevenue),
    totalCommitted: round2(totalCommitted),
    spentPct,
    committedPct,
    deviation,
    deviationPct,
    isOverBudget: deviation < 0,
    profitLoss,
    targetProfitAmount,
    projectedProfitAtBudget,
  };
}

/** يجمع المصروفات والإيرادات شهرياً (YYYY-MM) للتدفق النقدي - بيانات فعلية من amount/date. */
export function computeCashFlowByMonth(items) {
  const byMonth = new Map();
  for (const i of items) {
    if (i.item_type !== 'expense' && i.item_type !== 'revenue') continue;
    const month = (i.date || i.created_at || '').slice(0, 7);
    if (!month) continue;
    if (!byMonth.has(month)) byMonth.set(month, { month, expenses: 0, revenue: 0 });
    const bucket = byMonth.get(month);
    if (i.item_type === 'expense') bucket.expenses += Number(i.amount) || 0;
    else bucket.revenue += Number(i.amount) || 0;
  }
  return [...byMonth.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((b) => ({ ...b, expenses: round2(b.expenses), revenue: round2(b.revenue), net: round2(b.revenue - b.expenses) }));
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}
