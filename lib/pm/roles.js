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
  // القسم السادس: نظام إدارة الأعمال - ثلاثة أدوار جديدة من البند 17 (قواعد الصلاحيات) لهذا القسم
  { key: 'business_manager', label_ar: 'مدير الأعمال' },
  { key: 'contracts_officer', label_ar: 'مسؤول العقود' },
  { key: 'procurement_officer', label_ar: 'مسؤول المشتريات' },
];

export const MODULES = [
  'project', 'phase', 'task', 'team', 'budget', 'resource',
  'risk', 'quality', 'safety', 'document', 'meeting', 'report',
  'schedule', // القسم الخامس: نظام الجدول الزمني (جداول/أنشطة WBS/علاقات/موارد الأنشطة/Baselines)
  // القسم السادس: نظام إدارة الأعمال - وحدة صلاحية مستقلة لكل مجموعة كيانات تجارية (البند 17:
  // "نظام صلاحيات دقيق حسب الدور"). biz_payment تغطي معاً المستخلصات/الدفعات (البند 9) وأوامر
  // التغيير التجارية (البند 10) لأن كلتيهما عملية مالية حساسة على نفس العقد بنفس دورة اعتماد.
  'biz_client', 'biz_opportunity', 'biz_quote', 'biz_contract', 'biz_partner',
  'biz_work_order', 'biz_payment', 'biz_correspondence', 'biz_meeting', 'biz_commitment',
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
    biz_client: E(), biz_opportunity: V(), biz_quote: V(), biz_contract: E(),
    biz_partner: E(), biz_work_order: F(true), biz_payment: V(),
    biz_correspondence: E(), biz_meeting: E(), biz_commitment: E(),
  },

  project_manager: {
    project: E(true), phase: F(), task: F(true), team: F(), budget: E(),
    resource: E(), risk: F(), quality: E(), safety: E(), document: F(true),
    meeting: F(), report: F(), schedule: F(true),
    biz_client: V(), biz_opportunity: V(), biz_quote: V(), biz_contract: V(),
    biz_partner: V(), biz_work_order: E(true), biz_payment: V(),
    biz_correspondence: E(), biz_meeting: E(), biz_commitment: E(),
  },

  // القسم الخامس: نظام الجدول الزمني - المؤلف الأساسي (WBS/العلاقات/المسار الحرج/الموارد/Baselines)
  planning_engineer: {
    project: V(), phase: V(), task: E(), team: V(), budget: NONE,
    resource: E(), risk: NONE, quality: NONE, safety: NONE, document: V(),
    meeting: V(), report: F(), schedule: F(true),
    biz_client: NONE, biz_opportunity: NONE, biz_quote: NONE, biz_contract: V(),
    biz_partner: NONE, biz_work_order: V(), biz_payment: NONE,
    biz_correspondence: NONE, biz_meeting: NONE, biz_commitment: NONE,
  },

  engineer: {
    project: V(), phase: V(), task: E(), team: V(), budget: V(),
    resource: V(), risk: E(), quality: E(), safety: V(), document: E(),
    meeting: V(), report: V(), schedule: E(),
    biz_client: NONE, biz_opportunity: NONE, biz_quote: V(), biz_contract: V(),
    biz_partner: V(), biz_work_order: E(), biz_payment: NONE,
    biz_correspondence: V(), biz_meeting: V(), biz_commitment: V(),
  },

  supervisor: {
    project: V(), phase: V(), task: E(), team: E(), budget: V(),
    resource: E(), risk: V(), quality: E(), safety: E(), document: V(),
    meeting: V(), report: V(), schedule: E(),
    biz_client: NONE, biz_opportunity: NONE, biz_quote: NONE, biz_contract: NONE,
    biz_partner: V(), biz_work_order: E(), biz_payment: NONE,
    biz_correspondence: NONE, biz_meeting: V(), biz_commitment: V(),
  },

  accountant: {
    project: V(), phase: V(), task: V(), team: V(), budget: F(true),
    resource: V(), risk: V(), quality: NONE, safety: NONE, document: V(),
    meeting: NONE, report: E(), schedule: V(),
    biz_client: V(), biz_opportunity: NONE, biz_quote: V(), biz_contract: V(),
    biz_partner: V(), biz_work_order: V(), biz_payment: F(true),
    biz_correspondence: NONE, biz_meeting: NONE, biz_commitment: V(),
  },

  quality_officer: {
    project: V(), phase: V(), task: V(), team: V(), budget: NONE,
    resource: V(), risk: E(), quality: F(true), safety: V(), document: E(),
    meeting: V(), report: E(), schedule: V(),
    biz_client: NONE, biz_opportunity: NONE, biz_quote: NONE, biz_contract: NONE,
    biz_partner: E(), biz_work_order: V(), biz_payment: NONE,
    biz_correspondence: NONE, biz_meeting: NONE, biz_commitment: NONE,
  },

  safety_officer: {
    project: V(), phase: V(), task: V(), team: V(), budget: NONE,
    resource: V(), risk: E(), quality: V(), safety: F(true), document: E(),
    meeting: V(), report: E(), schedule: V(),
    biz_client: NONE, biz_opportunity: NONE, biz_quote: NONE, biz_contract: NONE,
    biz_partner: E(), biz_work_order: V(), biz_payment: NONE,
    biz_correspondence: NONE, biz_meeting: NONE, biz_commitment: NONE,
  },

  client: {
    project: V(), phase: V(true), task: V(), team: NONE, budget: NONE,
    resource: NONE, risk: NONE, quality: NONE, safety: NONE, document: V(true),
    meeting: V(), report: V(), schedule: V(),
    biz_client: NONE, biz_opportunity: NONE, biz_quote: V(), biz_contract: V(),
    biz_partner: NONE, biz_work_order: V(), biz_payment: V(),
    biz_correspondence: V(), biz_meeting: V(), biz_commitment: NONE,
  },

  technician: {
    project: V(), phase: V(), task: E(), team: NONE, budget: NONE,
    resource: V(), risk: V(), quality: V(), safety: V(), document: V(),
    meeting: NONE, report: NONE, schedule: E(),
    biz_client: NONE, biz_opportunity: NONE, biz_quote: NONE, biz_contract: NONE,
    biz_partner: NONE, biz_work_order: V(), biz_payment: NONE,
    biz_correspondence: NONE, biz_meeting: NONE, biz_commitment: NONE,
  },

  worker: {
    project: NONE, phase: NONE, task: E(), team: NONE, budget: NONE,
    resource: NONE, risk: NONE, quality: NONE, safety: V(), document: NONE,
    meeting: NONE, report: NONE, schedule: E(),
    biz_client: NONE, biz_opportunity: NONE, biz_quote: NONE, biz_contract: NONE,
    biz_partner: NONE, biz_work_order: NONE, biz_payment: NONE,
    biz_correspondence: NONE, biz_meeting: NONE, biz_commitment: NONE,
  },

  contractor_rep: {
    project: V(), phase: V(), task: V(), team: NONE, budget: NONE,
    resource: V(), risk: V(), quality: V(), safety: V(), document: E(),
    meeting: V(), report: V(), schedule: V(),
    biz_client: NONE, biz_opportunity: NONE, biz_quote: NONE, biz_contract: NONE,
    biz_partner: V(), biz_work_order: V(), biz_payment: NONE,
    biz_correspondence: E(), biz_meeting: V(), biz_commitment: V(),
  },

  supplier_rep: {
    project: V(), phase: NONE, task: V(), team: NONE, budget: NONE,
    resource: E(), risk: NONE, quality: NONE, safety: NONE, document: E(),
    meeting: NONE, report: NONE, schedule: V(),
    biz_client: NONE, biz_opportunity: NONE, biz_quote: NONE, biz_contract: NONE,
    biz_partner: V(), biz_work_order: V(), biz_payment: NONE,
    biz_correspondence: E(), biz_meeting: NONE, biz_commitment: V(),
  },

  consultant_rep: {
    project: V(), phase: V(), task: V(), team: NONE, budget: NONE,
    resource: V(), risk: V(), quality: E(true), safety: V(), document: E(true),
    meeting: V(), report: V(), schedule: V(),
    biz_client: NONE, biz_opportunity: NONE, biz_quote: V(), biz_contract: V(),
    biz_partner: V(), biz_work_order: V(), biz_payment: NONE,
    biz_correspondence: V(), biz_meeting: V(), biz_commitment: V(),
  },

  // ============ القسم السادس: نظام إدارة الأعمال - ثلاثة أدوار جديدة (البند 17) ============

  // مدير الأعمال: مالك القسم السادس بالكامل - صلاحية كاملة + اعتماد على كل الوحدات التجارية،
  // مع رؤية/تعديل معتدلة على وحدات القسم الرابع ذات الصلة (الميزانية/التقارير/المستندات).
  business_manager: {
    project: V(), phase: V(), task: E(), team: NONE, budget: E(),
    resource: NONE, risk: V(), quality: NONE, safety: NONE, document: E(true),
    meeting: E(), report: F(), schedule: V(),
    biz_client: F(true), biz_opportunity: F(true), biz_quote: F(true), biz_contract: F(true),
    biz_partner: F(true), biz_work_order: F(true), biz_payment: F(true),
    biz_correspondence: F(true), biz_meeting: F(true), biz_commitment: F(true),
  },

  // مسؤول العقود: صلاحية كاملة على العقود واعتماد المستخلصات/أوامر التغيير المرتبطة بها.
  contracts_officer: {
    project: V(), phase: NONE, task: NONE, team: NONE, budget: V(),
    resource: NONE, risk: NONE, quality: NONE, safety: NONE, document: E(true),
    meeting: V(), report: E(), schedule: NONE,
    biz_client: V(), biz_opportunity: V(), biz_quote: V(), biz_contract: F(true),
    biz_partner: V(), biz_work_order: V(), biz_payment: E(true),
    biz_correspondence: E(), biz_meeting: V(), biz_commitment: F(true),
  },

  // مسؤول المشتريات: صلاحية كاملة على المقاولين/الموردين وأوامر العمل المرتبطة بالتوريد.
  procurement_officer: {
    project: V(), phase: NONE, task: NONE, team: NONE, budget: NONE,
    resource: E(), risk: NONE, quality: NONE, safety: NONE, document: E(),
    meeting: V(), report: E(), schedule: NONE,
    biz_client: NONE, biz_opportunity: NONE, biz_quote: NONE, biz_contract: V(),
    biz_partner: F(true), biz_work_order: E(true), biz_payment: V(),
    biz_correspondence: E(), biz_meeting: V(), biz_commitment: E(),
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
