// lib/business/reportsData.js
// =============================================================================
// يبني الشكل النهائي لكل نوع من تقارير القسم السادس (البند 19) من بيانات حقيقية مُمرَّرة إليه
// فقط (لا اتصال قاعدة بيانات هنا - ذلك في lib/business/db/*)، بنفس فلسفة lib/pm/reportsData.js
// تماماً. "تقرير الدفعات" و"تقرير المستخلصات" في المواصفة مُدمَجان هنا في buildPaymentsReport
// لأنهما نفس الكيان فعلياً في هذا التصميم (بند 24: عدم تكرار البيانات في أكثر من جدول).
// =============================================================================
import { computeWeightedPipelineValue } from './calc.js';

function sumBy(rows, key) {
  return Math.round(rows.reduce((s, r) => s + (Number(r[key]) || 0), 0) * 100) / 100;
}
function countBy(rows, key) {
  const out = {};
  for (const r of rows) out[r[key]] = (out[r[key]] || 0) + 1;
  return out;
}

export function buildClientsReport({ clients }) {
  return {
    reportType: 'clients',
    totals: { count: clients.length, byStatus: countBy(clients, 'status'), byType: countBy(clients, 'client_type') },
    clients,
  };
}

export function buildOpportunitiesReport({ opportunities }) {
  const open = opportunities.filter((o) => !['won', 'lost'].includes(o.stage));
  const won = opportunities.filter((o) => o.stage === 'won');
  const lost = opportunities.filter((o) => o.stage === 'lost');
  return {
    reportType: 'opportunities',
    totals: {
      count: opportunities.length, open: open.length, won: won.length, lost: lost.length,
      winRatePct: won.length + lost.length > 0 ? Math.round((won.length / (won.length + lost.length)) * 1000) / 10 : null,
      weightedPipeline: computeWeightedPipelineValue(open), byStage: countBy(opportunities, 'stage'),
    },
    opportunities,
  };
}

export function buildQuotesReport({ quotes }) {
  return {
    reportType: 'quotes',
    totals: { count: quotes.length, totalValue: sumBy(quotes, 'total'), byStatus: countBy(quotes, 'status') },
    quotes,
  };
}

export function buildContractsReport({ contracts }) {
  return {
    reportType: 'contracts',
    totals: {
      count: contracts.length, totalOriginalValue: sumBy(contracts, 'original_value'),
      totalCurrentValue: sumBy(contracts, 'current_value'), byStatus: countBy(contracts, 'status'),
    },
    contracts,
  };
}

export function buildPartnersReport({ partners, partnerType }) {
  return {
    reportType: partnerType === 'supplier' ? 'suppliers' : 'contractors',
    totals: {
      count: partners.length, byStatus: countBy(partners, 'status'),
      avgQuality: partners.length ? Math.round((sumBy(partners, 'rating_quality') / partners.length) * 100) / 100 : null,
    },
    partners,
  };
}

export function buildWorkOrdersReport({ workOrders }) {
  return {
    reportType: 'work_orders',
    totals: { count: workOrders.length, totalCost: sumBy(workOrders, 'cost'), byStatus: countBy(workOrders, 'status') },
    workOrders,
  };
}

export function buildPaymentsReport({ payments }) {
  return {
    reportType: 'payments',
    totals: {
      count: payments.length, totalNetDue: sumBy(payments, 'net_due'),
      totalPaid: sumBy(payments.filter((p) => p.status === 'paid'), 'net_due'),
      totalPending: sumBy(payments.filter((p) => ['submitted', 'pending_approval'].includes(p.status)), 'net_due'),
      byStatus: countBy(payments, 'status'),
    },
    payments,
  };
}

export function buildChangeOrdersReport({ changeOrders }) {
  return {
    reportType: 'change_orders',
    totals: {
      count: changeOrders.length, netApprovedDelta: sumBy(changeOrders.filter((c) => c.status === 'approved'), 'delta_value'),
      byStatus: countBy(changeOrders, 'status'),
    },
    changeOrders,
  };
}

export function buildCommitmentsReport({ commitments }) {
  return {
    reportType: 'commitments',
    totals: { count: commitments.length, overdue: commitments.filter((c) => c.status === 'overdue').length, byStatus: countBy(commitments, 'status') },
    commitments,
  };
}

/** التقرير التنفيذي - ملخص شامل من كل الوحدات لعرض تنفيذي واحد (البند 19 + مساعد AI البند 20). */
export function buildExecutiveReport({ dashboardStats, topClients, topContracts, overdueCommitments }) {
  return {
    reportType: 'executive',
    generatedAt: new Date().toISOString(),
    kpis: dashboardStats,
    topClients,
    topContracts,
    overdueCommitments,
  };
}
