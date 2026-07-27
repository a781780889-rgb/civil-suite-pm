import { NextResponse } from 'next/server';
import { listClientsPaged } from '@/lib/business/db/clients.js';
import { listOpportunitiesPaged } from '@/lib/business/db/opportunities.js';
import { listQuotesPaged } from '@/lib/business/db/quotes.js';
import { listContractsPaged } from '@/lib/business/db/contracts.js';
import { listPartnersPaged } from '@/lib/business/db/partners.js';
import { listWorkOrdersPaged } from '@/lib/business/db/workOrders.js';
import { listCommitmentsPaged } from '@/lib/business/db/commitments.js';
import { getBusinessDashboardStats } from '@/lib/business/db/dashboard.js';
import { bdb } from '@/lib/business/schema.js';
import { logBizReportGeneration } from '@/lib/business/db/reports.js';
import {
  buildClientsReport, buildOpportunitiesReport, buildQuotesReport, buildContractsReport, buildPartnersReport,
  buildWorkOrdersReport, buildPaymentsReport, buildChangeOrdersReport, buildCommitmentsReport, buildExecutiveReport,
} from '@/lib/business/reportsData.js';
import { buildPmCsv } from '@/lib/pm/exporters/csv.js';
import { buildPmExcelReport } from '@/lib/pm/exporters/excel.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleBizError } from '@/lib/business/apiHelpers.js';

const TITLES = {
  clients: 'تقرير العملاء', opportunities: 'تقرير الفرص', quotes: 'تقرير عروض الأسعار', contracts: 'تقرير العقود',
  contractors: 'تقرير المقاولين', suppliers: 'تقرير الموردين', work_orders: 'تقرير أوامر العمل',
  payments: 'تقرير المستخلصات والدفعات', change_orders: 'تقرير التغييرات', commitments: 'تقرير الالتزامات',
  executive: 'التقرير التنفيذي',
};
const ALL = { page: 1, pageSize: 100000 };

function buildReport(type, searchParams) {
  const client_id = searchParams.get('client_id') || undefined;
  const status = searchParams.get('status') || undefined;
  switch (type) {
    case 'clients': return buildClientsReport({ clients: listClientsPaged({ status, ...ALL }).rows });
    case 'opportunities': return buildOpportunitiesReport({ opportunities: listOpportunitiesPaged({ client_id, ...ALL }).rows });
    case 'quotes': return buildQuotesReport({ quotes: listQuotesPaged({ client_id, status, ...ALL }).rows });
    case 'contracts': return buildContractsReport({ contracts: listContractsPaged({ client_id, status, ...ALL }).rows });
    case 'contractors': return buildPartnersReport({ partners: listPartnersPaged({ partner_type: 'contractor', status, ...ALL }).rows, partnerType: 'contractor' });
    case 'suppliers': return buildPartnersReport({ partners: listPartnersPaged({ partner_type: 'supplier', status, ...ALL }).rows, partnerType: 'supplier' });
    case 'work_orders': return buildWorkOrdersReport({ workOrders: listWorkOrdersPaged({ status, ...ALL }).rows });
    case 'payments': return buildPaymentsReport({ payments: bdb().prepare(`SELECT p.*, k.title AS contract_title FROM biz_progress_payments p LEFT JOIN biz_contracts k ON k.id = p.contract_id ${status ? 'WHERE p.status = ?' : ''} ORDER BY p.period_to DESC`).all(...(status ? [status] : [])) });
    case 'change_orders': return buildChangeOrdersReport({ changeOrders: bdb().prepare(`SELECT c.*, k.title AS contract_title FROM biz_change_orders c LEFT JOIN biz_contracts k ON k.id = c.contract_id ${status ? 'WHERE c.status = ?' : ''} ORDER BY c.created_at DESC`).all(...(status ? [status] : [])) });
    case 'commitments': return buildCommitmentsReport({ commitments: listCommitmentsPaged({ status, ...ALL }).rows });
    case 'executive': {
      const dashboardStats = getBusinessDashboardStats();
      const topClients = bdb().prepare(`SELECT c.id, c.name, COALESCE(SUM(k.current_value),0) AS totalContractsValue FROM biz_clients c JOIN biz_contracts k ON k.client_id = c.id GROUP BY c.id ORDER BY totalContractsValue DESC LIMIT 10`).all();
      const topContracts = bdb().prepare(`SELECT id, title, current_value, status, end_date FROM biz_contracts ORDER BY current_value DESC LIMIT 10`).all();
      const overdueCommitments = listCommitmentsPaged({ overdue: true, ...ALL }).rows;
      return buildExecutiveReport({ dashboardStats, topClients, topContracts, overdueCommitments });
    }
    default: return null;
  }
}

/** يبني (أعمدة CSV/Excel، صفوف) من ناتج كل نوع تقرير - يُستخدم فقط عند format=csv|excel. */
function toTabular(type, report) {
  const M = {
    clients: [{ key: 'client_code', label: 'الرقم' }, { key: 'name', label: 'الاسم' }, { key: 'client_type', label: 'النوع' }, { key: 'phone', label: 'الهاتف' }, { key: 'email', label: 'البريد' }, { key: 'status', label: 'الحالة' }],
    opportunities: [{ key: 'opp_code', label: 'الرقم' }, { key: 'name', label: 'الفرصة' }, { key: 'client_name', label: 'العميل' }, { key: 'expected_value', label: 'القيمة المتوقعة' }, { key: 'win_probability', label: 'احتمالية الفوز %' }, { key: 'stage', label: 'المرحلة' }],
    quotes: [{ key: 'quote_no', label: 'الرقم' }, { key: 'title', label: 'العنوان' }, { key: 'client_name', label: 'العميل' }, { key: 'total', label: 'الإجمالي' }, { key: 'status', label: 'الحالة' }, { key: 'validity_date', label: 'الصلاحية حتى' }],
    contracts: [{ key: 'contract_no', label: 'الرقم' }, { key: 'title', label: 'العنوان' }, { key: 'client_name', label: 'العميل' }, { key: 'current_value', label: 'القيمة الحالية' }, { key: 'status', label: 'الحالة' }, { key: 'end_date', label: 'تاريخ الانتهاء' }],
    contractors: [{ key: 'partner_code', label: 'الرقم' }, { key: 'company_name', label: 'الاسم' }, { key: 'specialty', label: 'التخصص' }, { key: 'rating_quality', label: 'تقييم الجودة' }, { key: 'status', label: 'الحالة' }],
    suppliers: [{ key: 'partner_code', label: 'الرقم' }, { key: 'company_name', label: 'الاسم' }, { key: 'materials_services', label: 'المواد/الخدمات' }, { key: 'rating_quality', label: 'تقييم الجودة' }, { key: 'status', label: 'الحالة' }],
    work_orders: [{ key: 'wo_no', label: 'الرقم' }, { key: 'activity', label: 'النشاط' }, { key: 'responsible', label: 'المسؤول' }, { key: 'due_date', label: 'الاستحقاق' }, { key: 'cost', label: 'التكلفة' }, { key: 'status', label: 'الحالة' }],
    payments: [{ key: 'certificate_no', label: 'رقم المستخلص' }, { key: 'contract_title', label: 'العقد' }, { key: 'period_to', label: 'حتى تاريخ' }, { key: 'net_due', label: 'صافي المستحق' }, { key: 'status', label: 'الحالة' }],
    change_orders: [{ key: 'co_no', label: 'الرقم' }, { key: 'contract_title', label: 'العقد' }, { key: 'description', label: 'الوصف' }, { key: 'delta_value', label: 'فرق القيمة' }, { key: 'status', label: 'الحالة' }],
    commitments: [{ key: 'title', label: 'الالتزام' }, { key: 'responsible', label: 'المسؤول' }, { key: 'due_date', label: 'الاستحقاق' }, { key: 'priority', label: 'الأولوية' }, { key: 'status', label: 'الحالة' }],
  };
  const rowsKey = { clients: 'clients', opportunities: 'opportunities', quotes: 'quotes', contracts: 'contracts', contractors: 'partners', suppliers: 'partners', work_orders: 'workOrders', payments: 'payments', change_orders: 'changeOrders', commitments: 'commitments' };
  if (M[type]) return [{ sectionTitle: TITLES[type], columns: M[type], rows: report[rowsKey[type]] }];
  // التنفيذي: يُصدَّر كملخص مؤشرات واحد (JSON) - جدوليته الطبيعية أقل وضوحاً في صف/عمود
  return [{ sectionTitle: 'المؤشرات التنفيذية', columns: [{ key: 'k', label: 'المؤشر' }, { key: 'v', label: 'القيمة' }], rows: Object.entries(report.kpis || {}).flatMap(([k, v]) => (typeof v === 'object' ? Object.entries(v).map(([k2, v2]) => ({ k: `${k}.${k2}`, v: typeof v2 === 'object' ? JSON.stringify(v2) : v2 })) : [{ k, v }])) }];
}

export async function GET(request, { params }) {
  try {
    const { type } = await params;
    if (!TITLES[type]) return NextResponse.json({ success: false, error: `نوع تقرير غير معروف: ${type}` }, { status: 400 });
    const { searchParams } = new URL(request.url);
    const { actor, actor_role } = getActor({}, request);
    assertPermission(actor_role, 'report', 'view');

    const report = buildReport(type, searchParams);
    const format = searchParams.get('format') || 'json';
    logBizReportGeneration(type, format, actor);

    if (format === 'csv') {
      const [section] = toTabular(type, report);
      const csv = buildPmCsv(section.columns, section.rows);
      return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="business-${type}-report.csv"` } });
    }
    if (format === 'excel') {
      const sections = toTabular(type, report);
      const buffer = await buildPmExcelReport({ title: TITLES[type], sections });
      return new NextResponse(buffer, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="business-${type}-report.xlsx"` } });
    }
    return NextResponse.json({ success: true, title: TITLES[type], report });
  } catch (err) {
    return handleBizError(err);
  }
}
