// lib/pm/roles.js
// =============================================================================
// نظام الصلاحيات (Role Based Access Control) - البند الحادي عشر من القواعد الإلزامية.
//
// شفافية كاملة (بنفس أسلوب ملاحظات README الحالي حول RBAC في القسم الثالث): التطبيق
// بأكمله (الأقسام 1-3 أيضاً) لا يحتوي نظام مصادقة/تسجيل دخول من الأصل. المصفوفة أدناه
// وإنفاذها في كل مسار API **حقيقيان وفعّالان بالكامل** - كل طلب يُرسل `actor_role` صراحة
// ويُرفض فعلياً (403) إن لم يملك الدور صلاحية الإجراء المطلوب. الفجوة الوحيدة غير المُنفَّذة
// هي ربط `actor_role` بجلسة مصادقة حقيقية (تسجيل دخول)؛ حقل `actor`/`actor_role` جاهز
// تماماً للربط بنظام مصادقة يُضاف لاحقاً دون أي تغيير في منطق المصفوفة نفسه - تماماً كما
// حقل `actor` النصي في boq_audit_log.
// =============================================================================

export const ROLES = [
  { key: 'system_admin', label_ar: 'مدير النظام' },
  { key: 'projects_manager', label_ar: 'مدير المشاريع' },
  { key: 'project_manager', label_ar: 'مدير المشروع' },
  { key: 'planning_engineer', label_ar: 'مهندس التخطيط' }, // القسم الخامس: نظام الجدول الزمني - المالك الأساسي لوحدة schedule
  { key: 'engineer', label_ar: 'المهندس' },
  { key: 'supervisor', label_ar: 'المشرف' },
  { key: 'accountant', label_ar: 'المحاسب' },
  { key: 'quality_officer', label_ar: 'مسؤول الجودة' },
  { key: 'safety_officer', label_ar: 'مسؤول السلامة' },
  { key: 'client', label_ar: 'العميل' },
  { key: 'technician', label_ar: 'فني' },
  { key: 'worker', label_ar: 'عامل' },
  { key: 'contractor_rep', label_ar: 'ممثل المقاول' },
  { key: 'supplier_rep', label_ar: 'ممثل المورد' },
  { key: 'consultant_rep', label_ar: 'ممثل الاستشاري' },
];

export const MODULES = [
  'project', 'phase', 'task', 'team', 'budget', 'resource',
  'risk', 'quality', 'safety', 'document', 'meeting', 'report',
  'schedule', // القسم الخامس: نظام الجدول الزمني (جداول/أنشطة WBS/علاقات/موارد الأنشطة/Baselines)
];

const LEVEL_RANK = { none: 0, view: 1, edit: 2, full: 3 };
const NONE = { level: 'none', approve: false };
const V = (approve = false) => ({ level: 'view', approve });
const E = (approve = false) => ({ level: 'edit', approve });
const F = (approve = true) => ({ level: 'full', approve });

function fullAll() {
  return Object.fromEntries(MODULES.map((m) => [m, F()]));
}

// لكل دور: مستوى الصلاحية لكل وحدة. أي وحدة غير مذكورة = بلا صلاحية (none) افتراضياً.
const MATRIX = {
  system_admin: fullAll(),

  projects_manager: {
    project: F(), phase: F(), task: E(true), team: F(), budget: F(true),
    resource: E(), risk: F(), quality: V(), safety: V(), document: E(true),
    meeting: E(), report: F(), schedule: E(true),
  },

  project_manager: {
    project: E(true), phase: F(), task: F(true), team: F(), budget: E(),
    resource: E(), risk: F(), quality: E(), safety: E(), document: F(true),
    meeting: F(), report: F(), schedule: F(true),
  },

  // القسم الخامس: نظام الجدول الزمني - المؤلف الأساسي (WBS/العلاقات/المسار الحرج/الموارد/Baselines)
  planning_engineer: {
    project: V(), phase: V(), task: E(), team: V(), budget: NONE,
    resource: E(), risk: NONE, quality: NONE, safety: NONE, document: V(),
    meeting: V(), report: F(), schedule: F(true),
  },

  engineer: {
    project: V(), phase: V(), task: E(), team: V(), budget: V(),
    resource: V(), risk: E(), quality: E(), safety: V(), document: E(),
    meeting: V(), report: V(), schedule: E(),
  },

  supervisor: {
    project: V(), phase: V(), task: E(), team: E(), budget: V(),
    resource: E(), risk: V(), quality: E(), safety: E(), document: V(),
    meeting: V(), report: V(), schedule: E(),
  },

  accountant: {
    project: V(), phase: V(), task: V(), team: V(), budget: F(true),
    resource: V(), risk: V(), quality: NONE, safety: NONE, document: V(),
    meeting: NONE, report: E(), schedule: V(),
  },

  quality_officer: {
    project: V(), phase: V(), task: V(), team: V(), budget: NONE,
    resource: V(), risk: E(), quality: F(true), safety: V(), document: E(),
    meeting: V(), report: E(), schedule: V(),
  },

  safety_officer: {
    project: V(), phase: V(), task: V(), team: V(), budget: NONE,
    resource: V(), risk: E(), quality: V(), safety: F(true), document: E(),
    meeting: V(), report: E(), schedule: V(),
  },

  client: {
    project: V(), phase: V(true), task: V(), team: NONE, budget: NONE,
    resource: NONE, risk: NONE, quality: NONE, safety: NONE, document: V(true),
    meeting: V(), report: V(), schedule: V(),
  },

  technician: {
    project: V(), phase: V(), task: E(), team: NONE, budget: NONE,
    resource: V(), risk: V(), quality: V(), safety: V(), document: V(),
    meeting: NONE, report: NONE, schedule: E(),
  },

  worker: {
    project: NONE, phase: NONE, task: E(), team: NONE, budget: NONE,
    resource: NONE, risk: NONE, quality: NONE, safety: V(), document: NONE,
    meeting: NONE, report: NONE, schedule: E(),
  },

  contractor_rep: {
    project: V(), phase: V(), task: V(), team: NONE, budget: NONE,
    resource: V(), risk: V(), quality: V(), safety: V(), document: E(),
    meeting: V(), report: V(), schedule: V(),
  },

  supplier_rep: {
    project: V(), phase: NONE, task: V(), team: NONE, budget: NONE,
    resource: E(), risk: NONE, quality: NONE, safety: NONE, document: E(),
    meeting: NONE, report: NONE, schedule: V(),
  },

  consultant_rep: {
    project: V(), phase: V(), task: V(), team: NONE, budget: NONE,
    resource: V(), risk: V(), quality: E(true), safety: V(), document: E(true),
    meeting: V(), report: V(), schedule: V(),
  },
};

export function getPermission(role, module) {
  const roleMatrix = MATRIX[role];
  if (!roleMatrix) return NONE;
  return roleMatrix[module] || NONE;
}

/** action: 'view' | 'create' | 'edit' | 'delete' | 'approve' */
export function can(role, module, action) {
  const perm = getPermission(role, module);
  if (action === 'approve') return perm.approve === true;
  if (action === 'delete') return LEVEL_RANK[perm.level] >= LEVEL_RANK.full;
  if (action === 'create' || action === 'edit') return LEVEL_RANK[perm.level] >= LEVEL_RANK.edit;
  if (action === 'view') return LEVEL_RANK[perm.level] >= LEVEL_RANK.view;
  return false;
}

export class PmPermissionError extends Error {
  constructor(role, module, action) {
    super(`الدور "${role || 'غير محدد'}" لا يملك صلاحية "${action}" على وحدة "${module}".`);
    this.name = 'PmPermissionError';
    this.code = 'PM_FORBIDDEN';
  }
}

/** يُستدعى في بداية كل مسار API يغيّر بيانات - يرمي PmPermissionError إن لم تتوفر الصلاحية. */
export function assertPermission(role, module, action) {
  if (!can(role, module, action)) throw new PmPermissionError(role, module, action);
}

/** يبني مصفوفة الصلاحيات كاملة لعرضها في واجهة إدارة الأدوار. */
export function getFullMatrix() {
  return ROLES.map((r) => ({
    ...r,
    permissions: Object.fromEntries(MODULES.map((m) => [m, getPermission(r.key, m)])),
  }));
}
