import { NextResponse } from 'next/server';
import { getSchedule } from '@/lib/schedule/db/schedules.js';
import { listActivities } from '@/lib/schedule/db/activities.js';
import { listResourcesForSchedule } from '@/lib/schedule/db/resources.js';
import { comparePlannedVsActual } from '@/lib/schedule/db/progress.js';
import { recalculateSchedule } from '@/lib/schedule/recalc.js';
import { findDelayedActivities } from '@/lib/schedule/criticalPath.js';
import {
  buildScheduleSummaryReport, buildProgressReport, buildCriticalPathReport,
  buildResourcesReport, buildDelayReport, buildVarianceReport, buildExecutiveReport,
} from '@/lib/schedule/reportsData.js';
import { buildPmCsv } from '@/lib/pm/exporters/csv.js';
import { buildPmExcelReport } from '@/lib/pm/exporters/excel.js';
import { logReportGenerated } from '@/lib/pm/db/reports.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';
import { assertPermission } from '@/lib/pm/roles.js';

const TITLES = {
  summary: 'تقرير الجدول الزمني', progress: 'تقرير نسبة الإنجاز', critical_path: 'تقرير المسار الحرج',
  resources: 'تقرير الموارد', delay: 'تقرير التأخير', variance: 'مقارنة المخطط بالفعلي', executive: 'التقرير التنفيذي',
};

function buildReport(type, ctx) {
  switch (type) {
    case 'summary': return buildScheduleSummaryReport(ctx);
    case 'progress': return buildProgressReport(ctx);
    case 'critical_path': return buildCriticalPathReport(ctx);
    case 'resources': return buildResourcesReport({ schedule: ctx.schedule, assignments: ctx.assignments });
    case 'delay': return buildDelayReport({ schedule: ctx.schedule, delayedActivities: ctx.delayedActivities });
    case 'variance': return buildVarianceReport({ schedule: ctx.schedule, comparison: ctx.comparison });
    case 'executive': return buildExecutiveReport(ctx);
    default: return null;
  }
}

function toTabular(type, report) {
  if (type === 'critical_path') return [{ sectionTitle: 'الأنشطة الحرجة', columns: [{ key: 'wbs_code', label: 'الكود' }, { key: 'name', label: 'النشاط' }, { key: 'planned_start', label: 'البداية' }, { key: 'planned_end', label: 'النهاية' }, { key: 'duration_days', label: 'المدة' }, { key: 'total_float_days', label: 'الطفو الكلي' }], rows: report.activities }];
  if (type === 'resources') return [{ sectionTitle: 'تعيينات الموارد', columns: [{ key: 'activity_name', label: 'النشاط' }, { key: 'resource_name', label: 'المورد' }, { key: 'resource_type', label: 'النوع' }, { key: 'quantity', label: 'الكمية' }, { key: 'planned_hours', label: 'الساعات' }, { key: 'planned_cost', label: 'التكلفة' }], rows: report.assignments }];
  if (type === 'delay') return [{ sectionTitle: 'الأنشطة المتأخرة', columns: [{ key: 'wbs_code', label: 'الكود' }, { key: 'name', label: 'النشاط' }, { key: 'planned_end', label: 'النهاية المخططة' }, { key: 'delayDays', label: 'أيام التأخير' }, { key: 'status', label: 'الحالة' }], rows: report.activities }];
  if (type === 'variance') return [{ sectionTitle: 'المخطط مقابل الفعلي', columns: [{ key: 'wbs_code', label: 'الكود' }, { key: 'name', label: 'النشاط' }, { key: 'planned_end', label: 'المخطط' }, { key: 'actual_end', label: 'الفعلي' }, { key: 'variance_days', label: 'الفرق (أيام)' }, { key: 'progress_pct', label: 'الإنجاز %' }], rows: report.activities }];
  if (type === 'progress') return [{ sectionTitle: 'إنجاز الأنشطة', columns: [{ key: 'wbs_code', label: 'الكود' }, { key: 'name', label: 'النشاط' }, { key: 'status', label: 'الحالة' }, { key: 'progress_pct', label: 'الإنجاز %' }, { key: 'planned_end', label: 'النهاية المخططة' }], rows: report.activities }];
  if (type === 'summary') return [{ sectionTitle: 'كل الأنشطة', columns: [{ key: 'wbs_code', label: 'الكود' }, { key: 'name', label: 'النشاط' }, { key: 'status', label: 'الحالة' }, { key: 'planned_start', label: 'البداية' }, { key: 'planned_end', label: 'النهاية' }, { key: 'progress_pct', label: 'الإنجاز %' }], rows: report.activities }];
  return [{ sectionTitle: 'ملخص تنفيذي', columns: [{ key: 'k', label: 'البند' }, { key: 'v', label: 'القيمة' }], rows: Object.entries(report).filter(([k]) => typeof report[k] !== 'object').map(([k, v]) => ({ k, v })) }];
}

export async function GET(request, { params }) {
  try {
    const { id, type } = await params;
    if (!TITLES[type]) return NextResponse.json({ success: false, error: `نوع تقرير غير معروف: ${type}` }, { status: 400 });
    const { actor, actor_role } = getActor({}, request);
    assertPermission(actor_role, 'schedule', 'view');

    const schedule = getSchedule(Number(id));
    if (!schedule) return NextResponse.json({ success: false, error: 'الجدول الزمني غير موجود.' }, { status: 404 });

    const computedResult = recalculateSchedule(schedule.id);
    const activities = listActivities(schedule.id);
    const ctx = {
      schedule, activities, computedResult,
      assignments: listResourcesForSchedule(schedule.id),
      delayedActivities: findDelayedActivities(activities, new Date().toISOString().slice(0, 10)),
      comparison: comparePlannedVsActual(schedule.id),
      resourceConflictsCount: 0,
    };

    const report = buildReport(type, ctx);
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';
    logReportGenerated({ project_id: schedule.project_id, report_type: `schedule_${type}`, format, generated_by: actor });

    if (format === 'csv') {
      const [section] = toTabular(type, report);
      const csv = buildPmCsv(section.columns, section.rows);
      return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="schedule-${type}-report.csv"` } });
    }
    if (format === 'excel') {
      const sections = toTabular(type, report);
      const buffer = await buildPmExcelReport({ title: TITLES[type], project: { name: schedule.project_name }, sections });
      return new NextResponse(buffer, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="schedule-${type}-report.xlsx"` } });
    }
    return NextResponse.json({ success: true, title: TITLES[type], report });
  } catch (err) {
    return handlePmError(err);
  }
}
