// lib/business/db/dashboard.js — لوحة التحكم ومؤشرات الأداء KPI، البندان 14 و15 من القواعد
// الإلزامية. كل رقم مُشتق بـ SQL حي من الجداول الفعلية وقت الطلب - لا تخزين مُسبق لأي KPI.
import { bdb } from '../schema.js';
import { computeWeightedPipelineValue } from '../calc.js';

export function getBusinessDashboardStats() {
  const db = bdb();
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const clients = db.prepare(`SELECT COUNT(*) AS n FROM biz_clients WHERE status = 'active'`).get().n;
  const openOpportunities = db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(expected_value),0) AS value FROM biz_opportunities WHERE stage NOT IN ('won','lost')`).get();
  const wonOpportunities = db.prepare(`SELECT COUNT(*) AS n FROM biz_opportunities WHERE stage = 'won'`).get().n;
  const closedOpportunities = db.prepare(`SELECT COUNT(*) AS n FROM biz_opportunities WHERE stage IN ('won','lost')`).get().n;
  const winRate = closedOpportunities > 0 ? Math.round((wonOpportunities / closedOpportunities) * 1000) / 10 : null;

  const activeQuotes = db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS value FROM biz_quotes WHERE status IN ('sent','under_review','negotiation')`).get();

  const contractsByStatus = db.prepare(`SELECT status, COUNT(*) AS n, COALESCE(SUM(current_value),0) AS value FROM biz_contracts GROUP BY status`).all();
  const totalContractsValue = db.prepare(`SELECT COALESCE(SUM(current_value),0) AS v FROM biz_contracts WHERE status NOT IN ('cancelled')`).get().v;
  const activeContractsValue = db.prepare(`SELECT COALESCE(SUM(current_value),0) AS v, COUNT(*) AS n FROM biz_contracts WHERE status = 'active'`).get();
  const expiringContracts = db.prepare(`SELECT COUNT(*) AS n FROM biz_contracts WHERE status = 'active' AND end_date IS NOT NULL AND end_date <= @in30`).get({ in30 }).n;

  const pendingChangeOrders = db.prepare(`SELECT COUNT(*) AS n FROM biz_change_orders WHERE status = 'pending_approval'`).get().n;
  const pendingPayments = db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(net_due),0) AS value FROM biz_progress_payments WHERE status IN ('submitted','pending_approval')`).get();
  const paidThisYear = db
    .prepare(`SELECT COALESCE(SUM(net_due),0) AS v FROM biz_progress_payments WHERE status = 'paid' AND strftime('%Y', paid_at) = strftime('%Y','now')`)
    .get().v;

  const overdueCommitments = db.prepare(`SELECT COUNT(*) AS n FROM biz_commitments WHERE status IN ('open','overdue') AND due_date IS NOT NULL AND due_date < @today`).get({ today }).n;
  const openWorkOrders = db.prepare(`SELECT COUNT(*) AS n FROM biz_work_orders WHERE status NOT IN ('completed','closed')`).get().n;

  const partnersByType = db.prepare(`SELECT partner_type, COUNT(*) AS n FROM biz_partners WHERE status = 'active' GROUP BY partner_type`).all();

  const openOppRows = db.prepare(`SELECT expected_value, win_probability, stage FROM biz_opportunities WHERE stage NOT IN ('won','lost')`).all();
  const weightedPipeline = computeWeightedPipelineValue(openOppRows);

  const recentActivity = db
    .prepare(
      `SELECT entity_type, entity_id, action, actor, created_at FROM biz_audit_log ORDER BY created_at DESC LIMIT 15`
    )
    .all();

  return {
    clients,
    opportunities: { open: openOpportunities.n, openValue: openOpportunities.value, weightedPipeline, winRatePct: winRate },
    quotes: { active: activeQuotes.n, activeValue: activeQuotes.value },
    contracts: {
      byStatus: contractsByStatus, totalValue: totalContractsValue,
      activeCount: activeContractsValue.n, activeValue: activeContractsValue.v, expiringSoon: expiringContracts,
    },
    changeOrders: { pendingApproval: pendingChangeOrders },
    payments: { pendingCount: pendingPayments.n, pendingValue: pendingPayments.value, paidThisYear },
    commitments: { overdue: overdueCommitments },
    workOrders: { open: openWorkOrders },
    partners: Object.fromEntries(partnersByType.map((r) => [r.partner_type, r.n])),
    recentActivity,
  };
}

/** مؤشرات KPI مستقلة قابلة للعرض في بطاقات منفصلة (البند 14) - تُشتق من نفس الدالة أعلاه. */
export function getBusinessKpis() {
  const s = getBusinessDashboardStats();
  return [
    { key: 'clients', label: 'عدد العملاء النشطين', value: s.clients },
    { key: 'opportunities', label: 'عدد الفرص المفتوحة', value: s.opportunities.open },
    { key: 'win_rate', label: 'معدل الفوز بالعروض', value: s.opportunities.winRatePct !== null ? `${s.opportunities.winRatePct}%` : '—' },
    { key: 'contracts_value', label: 'إجمالي قيمة العقود', value: s.contracts.totalValue },
    { key: 'pipeline_value', label: 'قيمة المشاريع المحتملة (مرجّحة)', value: s.opportunities.weightedPipeline },
    { key: 'revenue_ytd', label: 'الإيرادات المحصّلة (السنة الحالية)', value: s.payments.paidThisYear },
    { key: 'pending_dues', label: 'المستحقات (مستخلصات بانتظار الاعتماد)', value: s.payments.pendingValue },
    { key: 'active_contracts', label: 'العقود النشطة', value: s.contracts.activeCount },
    { key: 'expiring_contracts', label: 'عقود ستنتهي قريباً (٣٠ يوماً)', value: s.contracts.expiringSoon },
    { key: 'overdue_commitments', label: 'الالتزامات المتأخرة', value: s.commitments.overdue },
  ];
}
