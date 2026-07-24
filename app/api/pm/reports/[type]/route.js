import { NextResponse } from 'next/server';
import { getProjectById } from '@/lib/pm/db/projects.js';
import { listPhases } from '@/lib/pm/db/phases.js';
import { listTasks } from '@/lib/pm/db/tasks.js';
import { listBudgetItems } from '@/lib/pm/db/budget.js';
import { listAssignments } from '@/lib/pm/db/resources.js';
import { listRisks } from '@/lib/pm/db/risks.js';
import { listQualityRecords } from '@/lib/pm/db/quality.js';
import { listSafetyRecords } from '@/lib/pm/db/safety.js';
import { listMeetings } from '@/lib/pm/db/meetings.js';
import { logReportGenerated } from '@/lib/pm/db/reports.js';
import { findDelayedTasks } from '@/lib/pm/criticalPath.js';
import {
  buildPeriodActivityReport, buildProgressReport, buildFinancialReport, buildResourcesReport,
  buildQualityReport, buildSafetyReport, buildRiskReport, buildExecutiveReport,
} from '@/lib/pm/reportsData.js';
import { buildPmCsv } from '@/lib/pm/exporters/csv.js';
import { buildPmExcelReport } from '@/lib/pm/exporters/excel.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';

const TITLES = {
  daily: 'التقرير اليومي', weekly: 'التقرير الأسبوعي', monthly: 'التقرير الشهري',
  progress: 'تقرير الإنجاز', financial: 'التقرير المالي', resources: 'تقرير الموارد',
  quality: 'تقرير الجودة', safety: 'تقرير السلامة', risk: 'تقرير المخاطر', executive: 'التقرير التنفيذي',
};

function defaultRange(type) {
  const today = new Date();
  const end = today.toISOString().slice(0, 10);
  const days = type === 'weekly' ? 7 : type === 'monthly' ? 30 : 1;
  const start = new Date(today.getTime() - days * 86400000).toISOString().slice(0, 10);
  return { startDate: start, endDate: end };
}

function buildReport(type, ctx, searchParams) {
  switch (type) {
    case 'daily': case 'weekly': case 'monthly': {
      const range = searchParams.get('from') && searchParams.get('to') ? { startDate: searchParams.get('from'), endDate: searchParams.get('to') } : defaultRange(type);
      return buildPeriodActivityReport({ project: ctx.project, periodLabel: TITLES[type], ...range, tasks: ctx.tasks, budgetItems: ctx.budgetItems, safetyRecords: ctx.safetyRecords, qualityRecords: ctx.qualityRecords, meetings: ctx.meetings });
    }
    case 'progress': return buildProgressReport({ project: ctx.project, phases: ctx.phases, tasks: ctx.tasks });
    case 'financial': return buildFinancialReport({ project: ctx.project, budgetItems: ctx.budgetItems });
    case 'resources': return buildResourcesReport({ assignments: searchParams.get('resource_type') ? ctx.assignments.filter((a) => a.resource_type === searchParams.get('resource_type')) : ctx.assignments });
    case 'quality': return buildQualityReport({ records: ctx.qualityRecords });
    case 'safety': return buildSafetyReport({ records: ctx.safetyRecords });
    case 'risk': return buildRiskReport({ risks: ctx.risks });
    case 'executive': return buildExecutiveReport({ project: ctx.project, phases: ctx.phases, tasks: ctx.tasks, budgetItems: ctx.budgetItems, risks: ctx.risks, safetyRecords: ctx.safetyRecords, qualityRecords: ctx.qualityRecords, delayedTasks: ctx.delayedTasks });
    default: return null;
  }
}

/** يبني (أعمدة CSV/Excel، صفوف) من ناتج كل نوع تقرير - تُستخدم فقط عند format=csv|excel. */
function toTabular(type, report) {
  if (type === 'financial') return [{ sectionTitle: 'البنود المالية', columns: [{ key: 'item_type', label: 'النوع' }, { key: 'category', label: 'التصنيف' }, { key: 'description', label: 'الوصف' }, { key: 'amount', label: 'المبلغ' }, { key: 'date', label: 'التاريخ' }, { key: 'status', label: 'الحالة' }], rows: report.items }];
  if (type === 'risk') return [{ sectionTitle: 'سجل المخاطر', columns: [{ key: 'title', label: 'الخطر' }, { key: 'category', label: 'التصنيف' }, { key: 'probability', label: 'الاحتمالية' }, { key: 'impact', label: 'التأثير' }, { key: 'severityScore', label: 'درجة الخطورة' }, { key: 'owner', label: 'المسؤول' }, { key: 'status', label: 'الحالة' }], rows: report.risks }];
  if (type === 'quality') return [{ sectionTitle: 'سجلات الجودة', columns: [{ key: 'record_type', label: 'النوع' }, { key: 'title', label: 'العنوان' }, { key: 'result', label: 'النتيجة' }, { key: 'responsible', label: 'المسؤول' }, { key: 'record_date', label: 'التاريخ' }, { key: 'status', label: 'الحالة' }], rows: report.records }];
  if (type === 'safety') return [{ sectionTitle: 'سجلات السلامة', columns: [{ key: 'record_type', label: 'النوع' }, { key: 'title', label: 'العنوان' }, { key: 'severity', label: 'الخطورة' }, { key: 'responsible', label: 'المسؤول' }, { key: 'record_date', label: 'التاريخ' }, { key: 'status', label: 'الحالة' }], rows: report.records }];
  if (type === 'resources') return [{ sectionTitle: 'تعيينات الموارد', columns: [{ key: 'resource_name', label: 'المورد' }, { key: 'resource_type', label: 'النوع' }, { key: 'quantity', label: 'الكمية' }, { key: 'start_date', label: 'من' }, { key: 'end_date', label: 'إلى' }, { key: 'cost', label: 'التكلفة' }], rows: report.assignments }];
  if (type === 'progress') return [{ sectionTitle: 'المراحل', columns: [{ key: 'name', label: 'المرحلة' }, { key: 'status', label: 'الحالة' }, { key: 'progress_pct', label: 'نسبة الإنجاز %' }, { key: 'planned_start', label: 'البداية المخططة' }, { key: 'planned_end', label: 'النهاية المخططة' }], rows: report.phases }];
  // اليومي/الأسبوعي/الشهري والتنفيذي: يُصدَّران كملخص واحد فقط (JSON) - جدوليتها الطبيعية أقل وضوحاً في صف/عمود
  return [{ sectionTitle: 'ملخص', columns: [{ key: 'k', label: 'البند' }, { key: 'v', label: 'القيمة' }], rows: Object.entries(report).filter(([k]) => typeof report[k] !== 'object').map(([k, v]) => ({ k, v })) }];
}

export async function GET(request, { params }) {
  try {
    const { type } = await params;
    if (!TITLES[type]) return NextResponse.json({ success: false, error: `نوع تقرير غير معروف: ${type}` }, { status: 400 });
    const { searchParams } = new URL(request.url);
    const projectId = Number(searchParams.get('project_id'));
    if (!projectId) return NextResponse.json({ success: false, error: 'project_id مطلوب.' }, { status: 400 });
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'report', 'view');

    const project = getProjectById(projectId);
    if (!project) return NextResponse.json({ success: false, error: 'المشروع غير موجود.' }, { status: 404 });

    const ctx = {
      project,
      phases: listPhases(projectId),
      tasks: listTasks({ project_id: projectId }),
      budgetItems: listBudgetItems({ project_id: projectId }),
      assignments: listAssignments({ project_id: projectId }),
      risks: listRisks({ project_id: projectId }),
      qualityRecords: listQualityRecords({ project_id: projectId }),
      safetyRecords: listSafetyRecords({ project_id: projectId }),
      meetings: listMeetings({ project_id: projectId }),
    };
    ctx.delayedTasks = findDelayedTasks(ctx.tasks, new Date().toISOString().slice(0, 10));

    const report = buildReport(type, ctx, searchParams);
    const format = searchParams.get('format') || 'json';
    logReportGenerated({ project_id: projectId, report_type: type, format, generated_by: getActor({}, request).actor });

    if (format === 'csv') {
      const [section] = toTabular(type, report);
      const csv = buildPmCsv(section.columns, section.rows);
      return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${type}-report.csv"` } });
    }
    if (format === 'excel') {
      const sections = toTabular(type, report);
      const buffer = await buildPmExcelReport({ title: TITLES[type], project, sections });
      return new NextResponse(buffer, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${type}-report.xlsx"` } });
    }
    return NextResponse.json({ success: true, title: TITLES[type], report });
  } catch (err) {
    return handlePmError(err);
  }
}
