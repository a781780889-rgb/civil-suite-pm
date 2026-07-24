// tests/pm/calculations.test.js
// اختبارات وحدة لحسابات نسب الإنجاز والميزانية - بلا اتصال قاعدة بيانات.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeWeightedProgress, computeProjectProgress, computePhaseProgress } from '../../lib/pm/progress.js';
import { computeBudgetSummary, computeCashFlowByMonth } from '../../lib/pm/budgetCalc.js';
import { findConflictsForResource } from '../../lib/pm/resourceConflicts.js';

describe('computeWeightedProgress', () => {
  test('يُرجّح حسب مدة المهمة وليس متوسطاً بسيطاً', () => {
    // مهمة يوم واحد 100% + مهمة 9 أيام 0% => يجب أن تكون النتيجة قريبة من 10% لا 50%
    const pct = computeWeightedProgress([{ duration_days: 1, progress_pct: 100 }, { duration_days: 9, progress_pct: 0 }]);
    assert.equal(pct, 10);
  });
  test('يُعيد صفراً لقائمة فارغة', () => {
    assert.equal(computeWeightedProgress([]), 0);
  });
});

describe('computeProjectProgress', () => {
  test('يتجاهل المهام الفرعية عند وجود مهام رئيسية (لتفادي الحساب المزدوج)', () => {
    const tasks = [
      { id: 1, parent_task_id: null, duration_days: 10, progress_pct: 50 },
      { id: 2, parent_task_id: 1, duration_days: 5, progress_pct: 100 }, // فرعية - تُستبعد من حساب المشروع المباشر
    ];
    assert.equal(computeProjectProgress(tasks), 50);
  });
});

describe('computePhaseProgress', () => {
  test('يُعيد null عند عدم وجود مهام (لاستخدام القيمة اليدوية)', () => {
    assert.equal(computePhaseProgress([]), null);
  });
});

describe('computeBudgetSummary', () => {
  const project = { budget: 100000, contract_value: 130000, target_profit_pct: 15 };
  test('يحسب نسبة الصرف والانحراف والربح/الخسارة بدقة', () => {
    const items = [
      { item_type: 'expense', amount: 40000 },
      { item_type: 'expense', amount: 20000 },
      { item_type: 'revenue', amount: 50000 },
    ];
    const s = computeBudgetSummary(project, items);
    assert.equal(s.totalExpenses, 60000);
    assert.equal(s.spentPct, 60);
    assert.equal(s.deviation, 40000);
    assert.equal(s.isOverBudget, false);
    assert.equal(s.profitLoss, -10000);
  });
  test('أوامر التغيير على الميزانية تُعدّل الميزانية الحالية دون المساس برقم المشروع الأصلي', () => {
    const items = [{ item_type: 'change_order', category: 'budget', amount: 20000 }];
    const s = computeBudgetSummary(project, items);
    assert.equal(s.currentBudget, 120000);
    assert.equal(project.budget, 100000); // لم يتغيّر الأصل
  });
  test('تجاوز الميزانية يُحسب بعلامة سالبة للانحراف', () => {
    const items = [{ item_type: 'expense', amount: 150000 }];
    const s = computeBudgetSummary(project, items);
    assert.equal(s.isOverBudget, true);
    assert.ok(s.deviation < 0);
  });
});

describe('computeCashFlowByMonth', () => {
  test('يجمع المصروفات والإيرادات حسب الشهر بشكل صحيح', () => {
    const items = [
      { item_type: 'expense', amount: 1000, date: '2026-01-05' },
      { item_type: 'expense', amount: 500, date: '2026-01-20' },
      { item_type: 'revenue', amount: 2000, date: '2026-02-01' },
    ];
    const flow = computeCashFlowByMonth(items);
    assert.equal(flow.length, 2);
    assert.equal(flow[0].month, '2026-01');
    assert.equal(flow[0].expenses, 1500);
    assert.equal(flow[1].net, 2000);
  });
});

describe('findConflictsForResource', () => {
  test('يكتشف تداخل تعيينين لنفس المورد على مشروعين مختلفين', () => {
    const assignments = [
      { id: 1, project_id: 10, start_date: '2026-02-01', end_date: '2026-02-20', status: 'active' },
      { id: 2, project_id: 20, start_date: '2026-02-10', end_date: '2026-02-25', status: 'active' },
    ];
    const conflicts = findConflictsForResource(assignments);
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0].sameProject, false);
  });
  test('لا يُبلّغ عن تعارض لفترات غير متداخلة', () => {
    const assignments = [
      { id: 1, project_id: 10, start_date: '2026-01-01', end_date: '2026-01-10', status: 'active' },
      { id: 2, project_id: 20, start_date: '2026-02-01', end_date: '2026-02-10', status: 'active' },
    ];
    assert.equal(findConflictsForResource(assignments).length, 0);
  });
});
