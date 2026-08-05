// lib/hse/reportsData.js
// بناء بيانات التقارير (البند 19 + تقارير إضافية من الوثيقة الأولى) - كل دالة تُعيد
// {title, columns, rows} جاهزة للتصدير المباشر عبر lib/pm/exporters (excel/csv/docx) بلا أي
// منطق تصدير مكرر هنا - نفس مبدأ lib/equipment/reportsData.js تماماً.
import { hdb } from './schema.js';
import { getHseDashboard } from './db/dashboard.js';

function q(sql, params = {}) { return hdb().prepare(sql).all(params); }
const range = (from, to) => ({ from: from || '0000-01-01', to: to || '9999-12-31' });

export function buildIncidentsReport({ project_id, from, to } = {}) {
  const rows = q(`
    SELECT i.incident_no, i.incident_type, i.incident_date, i.location, p.name AS project,
      i.affected_persons, i.immediate_cause, i.root_cause, i.status
    FROM hse_incidents i LEFT JOIN projects p ON p.id = i.project_id
    WHERE i.incident_date BETWEEN @from AND @to ${project_id ? 'AND i.project_id = @project_id' : ''}
    ORDER BY i.incident_date DESC
  `, { ...range(from, to), project_id }).map((r) => {
    let injured_count = 0;
    try { injured_count = JSON.parse(r.affected_persons || '[]').length; } catch { /* بيانات قديمة غير متوقعة - نتجاهلها بأمان */ }
    return { ...r, injured_count };
  });
  return { title: 'تقرير الحوادث والإصابات', rows, columns: [
    { key: 'incident_no', label: 'رقم الحادث' }, { key: 'incident_type', label: 'النوع' }, { key: 'incident_date', label: 'التاريخ' },
    { key: 'location', label: 'الموقع' }, { key: 'project', label: 'المشروع' }, { key: 'injured_count', label: 'عدد المصابين' },
    { key: 'immediate_cause', label: 'السبب المباشر' }, { key: 'root_cause', label: 'السبب الجذري' }, { key: 'status', label: 'الحالة' },
  ] };
}

export function buildRisksReport({ project_id, status } = {}) {
  const rows = q(`
    SELECT r.risk_no, r.title, r.category, r.location, p.name AS project, r.likelihood, r.severity, r.risk_score, r.risk_level, r.status, r.responsible, r.review_date
    FROM hse_risks r LEFT JOIN projects p ON p.id = r.project_id
    WHERE 1=1 ${project_id ? 'AND r.project_id = @project_id' : ''} ${status ? 'AND r.status = @status' : ''}
    ORDER BY r.risk_score DESC
  `, { project_id, status });
  return { title: 'تقرير المخاطر', rows, columns: [
    { key: 'risk_no', label: 'رقم الخطر' }, { key: 'title', label: 'اسم الخطر' }, { key: 'category', label: 'الفئة' },
    { key: 'location', label: 'الموقع' }, { key: 'project', label: 'المشروع' }, { key: 'likelihood', label: 'الاحتمالية' },
    { key: 'severity', label: 'الشدة' }, { key: 'risk_score', label: 'الدرجة' }, { key: 'risk_level', label: 'المستوى' },
    { key: 'status', label: 'الحالة' }, { key: 'responsible', label: 'المسؤول' }, { key: 'review_date', label: 'تاريخ المراجعة' },
  ] };
}

export function buildInspectionsReport({ project_id, from, to } = {}) {
  const rows = q(`
    SELECT ins.inspection_no, ins.inspection_type, ins.inspection_date, ins.location, p.name AS project, ins.inspector,
      ins.overall_result, ins.status,
      (SELECT COUNT(*) FROM hse_inspection_items it WHERE it.inspection_id = ins.id AND it.is_compliant = 0) AS non_compliant_items
    FROM hse_inspections ins LEFT JOIN projects p ON p.id = ins.project_id
    WHERE ins.inspection_date BETWEEN @from AND @to ${project_id ? 'AND ins.project_id = @project_id' : ''}
    ORDER BY ins.inspection_date DESC
  `, { ...range(from, to), project_id });
  return { title: 'تقرير التفتيشات', rows, columns: [
    { key: 'inspection_no', label: 'رقم التفتيش' }, { key: 'inspection_type', label: 'النوع' }, { key: 'inspection_date', label: 'التاريخ' },
    { key: 'location', label: 'الموقع' }, { key: 'project', label: 'المشروع' }, { key: 'inspector', label: 'المفتِّش' },
    { key: 'overall_result', label: 'النتيجة العامة' }, { key: 'status', label: 'الحالة' }, { key: 'non_compliant_items', label: 'بنود غير مطابقة' },
  ] };
}

export function buildPermitsReport({ project_id, status } = {}) {
  const rows = q(`
    SELECT pm.permit_no, pm.permit_type, p.name AS project, pm.location, pm.start_date, pm.end_date, pm.responsible, pm.status
    FROM hse_permits pm LEFT JOIN projects p ON p.id = pm.project_id
    WHERE 1=1 ${project_id ? 'AND pm.project_id = @project_id' : ''} ${status ? 'AND pm.status = @status' : ''}
    ORDER BY pm.end_date DESC
  `, { project_id, status });
  return { title: 'تقرير تصاريح العمل', rows, columns: [
    { key: 'permit_no', label: 'رقم التصريح' }, { key: 'permit_type', label: 'النوع' }, { key: 'project', label: 'المشروع' },
    { key: 'location', label: 'الموقع' }, { key: 'start_date', label: 'تاريخ البداية' }, { key: 'end_date', label: 'تاريخ الانتهاء' },
    { key: 'responsible', label: 'المسؤول' }, { key: 'status', label: 'الحالة' },
  ] };
}

export function buildNearMissReport({ project_id } = {}) {
  const rows = q(`
    SELECT nm.near_miss_no, p.name AS project, nm.description, nm.location, nm.risk_level, nm.cause, nm.status, nm.created_at
    FROM hse_near_misses nm LEFT JOIN projects p ON p.id = nm.project_id
    WHERE 1=1 ${project_id ? 'AND nm.project_id = @project_id' : ''} ORDER BY nm.created_at DESC
  `, { project_id });
  return { title: 'تقرير البلاغات القريبة من الحوادث (Near Miss)', rows, columns: [
    { key: 'near_miss_no', label: 'رقم البلاغ' }, { key: 'project', label: 'المشروع' }, { key: 'description', label: 'الوصف' },
    { key: 'location', label: 'الموقع' }, { key: 'risk_level', label: 'مستوى الخطورة' }, { key: 'cause', label: 'السبب' }, { key: 'status', label: 'الحالة' },
  ] };
}

export function buildViolationsReport({ project_id, status } = {}) {
  const rows = q(`
    SELECT v.violation_no, p.name AS project, v.violation_type, v.severity, v.location, v.responsible_person, v.violation_date, v.status
    FROM hse_violations v LEFT JOIN projects p ON p.id = v.project_id
    WHERE 1=1 ${project_id ? 'AND v.project_id = @project_id' : ''} ${status ? 'AND v.status = @status' : ''}
    ORDER BY v.violation_date DESC
  `, { project_id, status });
  return { title: 'تقرير المخالفات', rows, columns: [
    { key: 'violation_no', label: 'رقم المخالفة' }, { key: 'project', label: 'المشروع' }, { key: 'violation_type', label: 'النوع' },
    { key: 'severity', label: 'الخطورة' }, { key: 'location', label: 'الموقع' }, { key: 'responsible_person', label: 'الشخص المسؤول' },
    { key: 'violation_date', label: 'التاريخ' }, { key: 'status', label: 'الحالة' },
  ] };
}

export function buildTrainingReport({ course_id } = {}) {
  const rows = q(`
    SELECT co.course_name, co.provider, c.trainee_name, c.certificate_no, c.issued_date, c.expiry_date,
      CASE WHEN c.status='revoked' THEN 'ملغاة' WHEN c.expiry_date IS NOT NULL AND c.expiry_date < date('now') THEN 'منتهية' ELSE 'سارية' END AS live_status
    FROM hse_training_certifications c JOIN hse_training_courses co ON co.id = c.course_id
    WHERE 1=1 ${course_id ? 'AND c.course_id = @course_id' : ''} ORDER BY c.issued_date DESC
  `, { course_id });
  return { title: 'تقرير التدريب والشهادات', rows, columns: [
    { key: 'course_name', label: 'الدورة' }, { key: 'provider', label: 'الجهة المقدِّمة' }, { key: 'trainee_name', label: 'المتدرب' },
    { key: 'certificate_no', label: 'رقم الشهادة' }, { key: 'issued_date', label: 'تاريخ الإصدار' }, { key: 'expiry_date', label: 'تاريخ الانتهاء' },
    { key: 'live_status', label: 'الحالة' },
  ] };
}

export function buildPpeReport({ project_id } = {}) {
  const rows = q(`
    SELECT i.item_name, i.item_type, d.employee_name, p.name AS project, d.quantity, d.issue_date, d.expiry_date, d.condition, d.status
    FROM hse_ppe_distributions d JOIN hse_ppe_items i ON i.id = d.ppe_item_id LEFT JOIN projects p ON p.id = d.project_id
    WHERE 1=1 ${project_id ? 'AND d.project_id = @project_id' : ''} ORDER BY d.issue_date DESC
  `, { project_id });
  return { title: 'تقرير معدات الوقاية الشخصية', rows, columns: [
    { key: 'item_name', label: 'المعدة' }, { key: 'item_type', label: 'النوع' }, { key: 'employee_name', label: 'الموظف المستلم' },
    { key: 'project', label: 'المشروع' }, { key: 'quantity', label: 'الكمية' }, { key: 'issue_date', label: 'تاريخ التسليم' },
    { key: 'expiry_date', label: 'تاريخ الانتهاء' }, { key: 'condition', label: 'الحالة الفنية' }, { key: 'status', label: 'حالة التوزيع' },
  ] };
}

export function buildKpisReport({ project_id, from, to } = {}) {
  const d = getHseDashboard({ project_id, from, to });
  const rows = [
    { indicator: 'عدد الحوادث', value: d.totals.incident_count },
    { indicator: 'عدد Near Miss', value: d.totals.near_miss_count },
    { indicator: 'معدل تكرار الحوادث (لكل مليون ساعة عمل)', value: d.kpis.incident_frequency_rate ?? 'غير متاح (بلا ساعات عمل مسجّلة)' },
    { indicator: 'معدل شدة الإصابات (لكل مليون ساعة عمل)', value: d.kpis.incident_severity_rate ?? 'غير متاح' },
    { indicator: 'عدد التفتيشات المنفذة', value: d.totals.inspections_completed },
    { indicator: 'نسبة إغلاق الإجراءات التصحيحية (%)', value: d.kpis.corrective_action_closure_rate ?? 'غير متاح' },
    { indicator: 'عدد التصاريح المفتوحة', value: d.totals.active_permits },
    { indicator: 'عدد المخاطر الحرجة', value: d.totals.critical_risk_count },
    { indicator: 'نسبة الالتزام بالتدريب (%)', value: d.kpis.training_compliance_rate ?? 'غير متاح' },
    { indicator: 'نسبة الالتزام العام بالسلامة (%)', value: d.kpis.compliance_rate ?? 'غير متاح' },
  ];
  return { title: 'تقرير مؤشرات الأداء (KPIs)', rows, columns: [{ key: 'indicator', label: 'المؤشر' }, { key: 'value', label: 'القيمة' }] };
}

/** التقرير التنفيذي (الوثيقة الأولى) - صفحة واحدة مجمّعة لكل الأرقام الرئيسية للإدارة العليا. */
export function buildExecutiveReport({ project_id, from, to } = {}) {
  const d = getHseDashboard({ project_id, from, to });
  const rows = [
    { section: 'المشاريع الملتزمة بالسلامة', value: `${d.totals.projects_compliant} من ${d.totals.total_projects}` },
    { section: 'إجمالي الحوادث', value: d.totals.incident_count },
    { section: 'إجمالي الإصابات', value: d.totals.injury_count },
    { section: 'المخالفات المفتوحة', value: d.totals.open_violation_count },
    { section: 'المخاطر الحرجة المفتوحة', value: d.totals.critical_risk_count },
    { section: 'التصاريح النشطة', value: d.totals.active_permits },
    { section: 'نسبة الالتزام العام بالسلامة', value: d.kpis.compliance_rate !== null ? `${d.kpis.compliance_rate}%` : 'غير متاح' },
    { section: 'معدل تكرار الحوادث', value: d.kpis.incident_frequency_rate ?? 'غير متاح' },
  ];
  return { title: 'التقرير التنفيذي لإدارة السلامة المهنية', rows, columns: [{ key: 'section', label: 'البند' }, { key: 'value', label: 'القيمة' }] };
}

export const HSE_REPORT_BUILDERS = {
  incidents: buildIncidentsReport, risks: buildRisksReport, inspections: buildInspectionsReport,
  permits: buildPermitsReport, near_miss: buildNearMissReport, violations: buildViolationsReport,
  training: buildTrainingReport, ppe: buildPpeReport, kpis: buildKpisReport, executive: buildExecutiveReport,
};
