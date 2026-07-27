// tests/business/db.test.js
// اختبار تكامل حقيقي (SQLite فعلية، بلا محاكاة) للسلسلة الكاملة المطلوبة صراحة في البند 25:
// عميل → فرصة → عرض سعر → عقد → أمر عمل → مستخلص → أمر تغيير → تقرير.
// تشغيل: node --test tests/business/db.test.js
// ملاحظة: يستخدم نفس data/civil-suite.sqlite3 الموحّد (كبقية اختبارات tests/pm)، ليس ملفاً يُشحن مع التسليم.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

let clients, opportunities, quotes, contracts, changeOrders, progressPayments, partners, workOrders, commitments, approvals, dashboard;

before(async () => {
  clients = await import('../../lib/business/db/clients.js');
  opportunities = await import('../../lib/business/db/opportunities.js');
  quotes = await import('../../lib/business/db/quotes.js');
  contracts = await import('../../lib/business/db/contracts.js');
  changeOrders = await import('../../lib/business/db/changeOrders.js');
  progressPayments = await import('../../lib/business/db/progressPayments.js');
  partners = await import('../../lib/business/db/partners.js');
  workOrders = await import('../../lib/business/db/workOrders.js');
  commitments = await import('../../lib/business/db/commitments.js');
  approvals = await import('../../lib/business/db/approvals.js');
  dashboard = await import('../../lib/business/db/dashboard.js');
});

describe('دورة حياة أعمال كاملة: عميل ← فرصة ← عرض سعر ← عقد ← أمر تغيير ← مستخلص', () => {
  let clientId, oppId, quoteId, contractId, coId, ppId;

  test('إنشاء عميل برقم فريد، ومنع تكراره', () => {
    const code = `TESTCL-${Date.now()}`;
    const c = clients.createClient({ name: 'شركة اختبار للمقاولات', client_code: code, phone: '0500000000', actor: 'test' });
    clientId = c.id;
    assert.ok(clientId > 0);
    const dup = clients.findDuplicateClient({ client_code: code });
    assert.equal(dup.id, clientId);
  });

  test('إنشاء فرصة تجارية مرتبطة بالعميل', () => {
    const o = opportunities.createOpportunity({ client_id: clientId, name: 'فرصة اختبار', expected_value: 500000, actor: 'test' });
    oppId = o.id;
    assert.equal(o.stage, 'new');
  });

  test('تحويل مراحل الفرصة حتى "عرض سعر"', () => {
    opportunities.changeOpportunityStage(oppId, 'qualified', { actor: 'test' });
    const o = opportunities.changeOpportunityStage(oppId, 'quote', { actor: 'test' });
    assert.equal(o.stage, 'quote');
  });

  test('رفض تحويل فرصة إلى "خسارة" بلا سبب', () => {
    assert.throws(() => opportunities.changeOpportunityStage(oppId, 'lost', { actor: 'test' }));
  });

  test('إنشاء عرض سعر ببنود، والإجماليات تُحسب فعلياً من البنود', () => {
    const q = quotes.createQuote({
      client_id: clientId, opportunity_id: oppId, title: 'عرض سعر اختبار', tax_pct: 15,
      items: [{ description: 'بند 1', quantity: 10, unit_price: 1000 }],
      actor: 'test',
    });
    quoteId = q.id;
    assert.equal(q.subtotal, 10000);
    assert.equal(q.total, 11500);
  });

  test('نقل عرض السعر إلى "فائز" يسجّل قراراً في سجل الموافقات', () => {
    quotes.transitionQuoteStatus(quoteId, { status: 'sent', actor: 'test', actor_role: 'business_manager' });
    quotes.transitionQuoteStatus(quoteId, { status: 'won', actor: 'test', actor_role: 'business_manager' });
    const log = approvals.listApprovals({ entity_type: 'quote', entity_id: quoteId });
    assert.ok(log.some((a) => a.action === 'approve'));
  });

  test('تحويل عرض السعر الفائز إلى عقد حقيقي بنفس القيمة', () => {
    const k = contracts.createContractFromQuote(quoteId, { actor: 'test', actor_role: 'business_manager' });
    contractId = k.id;
    assert.equal(k.original_value, 11500);
    assert.equal(k.current_value, 11500);
    assert.equal(k.client_id, clientId);
  });

  test('لا يمكن تحويل نفس عرض السعر إلى عقد مرتين', () => {
    assert.throws(() => contracts.createContractFromQuote(quoteId, { actor: 'test' }));
  });

  test('أمر تغيير لا يُحدّث قيمة العقد إلا بعد الاعتماد صراحة', () => {
    const co = changeOrders.createChangeOrder(contractId, { description: 'إضافة نطاق', delta_value: 2000, actor: 'test' });
    coId = co.id;
    let k = contracts.getContractById(contractId);
    assert.equal(k.current_value, 11500); // لم تتغيّر بعد

    changeOrders.submitChangeOrder(coId, { actor: 'test', actor_role: 'contracts_officer' });
    changeOrders.decideChangeOrder(coId, { approved: true, actor: 'test', actor_role: 'contracts_officer' });
    k = contracts.getContractById(contractId);
    assert.equal(k.current_value, 13500); // تغيّرت الآن فقط بعد الاعتماد
  });

  test('مستخلص: صافي المستحق يُحسب من قيمة الأعمال والضمان', () => {
    const pp = progressPayments.createProgressPayment(contractId, { work_value_to_date: 5000, previous_work_value: 0, retention_pct: 10, actor: 'test' });
    ppId = pp.id;
    assert.equal(pp.net_due, 4500); // 5000 - 10%
    progressPayments.submitProgressPayment(ppId, { actor: 'test', actor_role: 'accountant' });
    const approved = progressPayments.decideProgressPayment(ppId, { approved: true, actor: 'test', actor_role: 'accountant' });
    assert.equal(approved.status, 'approved');
    const paid = progressPayments.markProgressPaymentPaid(ppId, { actor: 'test' });
    assert.equal(paid.status, 'paid');
  });

  test('أمر عمل مرتبط بالعقد والعميل', () => {
    const wo = workOrders.createWorkOrder({ activity: 'تنفيذ بند اختبار', client_id: clientId, contract_id: contractId, actor: 'test' });
    assert.equal(wo.status, 'new');
    workOrders.transitionWorkOrderStatus(wo.id, 'approved', 'test');
    assert.equal(workOrders.getWorkOrderById(wo.id).status, 'approved');
  });

  test('التزام متأخر يُحدَّث تلقائياً عند الفحص الدوري', () => {
    const cm = commitments.createCommitment({ title: 'تجديد ضمان', due_date: '2020-01-01', actor: 'test' });
    commitments.refreshOverdueCommitments();
    assert.equal(commitments.getCommitmentById(cm.id).status, 'overdue');
  });

  test('لوحة التحكم تعكس العقد والفرصة والمستخلص المُنشأين فعلياً', () => {
    const stats = dashboard.getBusinessDashboardStats();
    assert.ok(stats.contracts.totalValue >= 13500);
    assert.ok(stats.payments.paidThisYear >= 4500);
  });
});

describe('منع تكرار بيانات الشركاء (البند 24)', () => {
  test('شريك برقم مكرر يُرفض', () => {
    const code = `PTEST-${Date.now()}`;
    partners.createPartner({ company_name: 'مقاول اختبار', partner_code: code, actor: 'test' });
    const dup = partners.findDuplicatePartner({ partner_code: code });
    assert.ok(dup);
  });

  test('تقييم شريك خارج نطاق 1-5 يُرفض', () => {
    const p = partners.createPartner({ company_name: `مقاول تقييم ${Date.now()}`, actor: 'test' });
    assert.throws(() => partners.addPartnerEvaluation(p.id, { quality: 9, schedule_adherence: 3, cost: 3, safety: 3, actor: 'test' }));
  });
});
