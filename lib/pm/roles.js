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
//
// القسم السابع (إدارة المعدات) وسّع هذا الملف بأربعة أدوار وست وحدات صلاحية جديدة، بنفس
// أسلوب توسعة القسمين الخامس والسادس له سابقاً - ملف صلاحيات واحد موحّد للمنصة كاملة.
//
// القسم الثامن (السلامة المهنية) يضيف تسع وحدات صلاحية جديدة، لكن دوراً جديداً واحداً فقط
// (hse_manager/مدير السلامة): بقية الأدوار التي تطلبها مواصفة القسم (مسؤول السلامة/مهندس
// السلامة، مدير المشروع، المهندس المشرف، المشرف الميداني، العامل، المقاول، العميل) تُطابق
// تماماً أدواراً موجودة أصلاً فوُسِّعت صفوفها بالأسفل بدل تكرارها: safety_officer،
// project_manager، engineer، supervisor، worker، contractor_rep، client على الترتيب.
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
  { key: 'safety_officer', label_ar: 'مسؤول/مهندس السلامة' },
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
  // القسم السابع: نظام إدارة المعدات - أربعة أدوار جديدة (البند 24: الصلاحيات RBAC)
  { key: 'equipment_manager', label_ar: 'مدير المعدات' },
  { key: 'maintenance_officer', label_ar: 'مسؤول الصيانة' },
  { key: 'warehouse_keeper', label_ar: 'أمين المخزن' },
  { key: 'operator', label_ar: 'المشغل' },
  // القسم الثامن: نظام إدارة السلامة المهنية - دور جديد واحد فقط (انظر ملاحظة الأعلى)
  { key: 'hse_manager', label_ar: 'مدير السلامة' },
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
  // القسم السابع: نظام إدارة المعدات - ست وحدات صلاحية تغطي دورة حياة المعدة كاملة (البند 24):
  // 'equipment' = السجل الرئيسي/التصنيفات/النقل، 'equipment_operation' = التشغيل/عداد الساعات/
  // الوقود/الحجوزات/التخصيص، 'equipment_maintenance' = الصيانة الوقائية والتصحيحية والأعطال،
  // 'equipment_spare_part' = مخزون قطع الغيار، 'equipment_operator' = سجلات وتراخيص المشغلين،
  // 'equipment_rental' = عقود الاستئجار. فحوصات السلامة (equipment_inspections) تُدار عبر وحدة
  // 'safety' الموجودة أصلاً - ربط حقيقي بقسم السلامة المهنية بدل تكرار وحدة صلاحية جديدة.
  'equipment', 'equipment_operation', 'equipment_maintenance',
  'equipment_spare_part', 'equipment_operator', 'equipment_rental',
  // القسم الثامن: نظام إدارة السلامة المهنية - تسع وحدات صلاحية تجمع أكثر من 20 جدولاً
  // مترابطاً حسب سير العمل الوظيفي الواحد (بنفس منطق equipment_maintenance التي تجمع
  // الصيانة الوقائية والتصحيحية والأعطال معاً): 'hse_risk' = سجل المخاطر ومواقع العمل،
  // 'hse_permit' = تصاريح العمل، 'hse_inspection' = التفتيشات والمخالفات (المخالفة عملياً
  // ملاحظة تفتيش)، 'hse_incident' = الحوادث والبلاغات القريبة من الحوادث، 'hse_corrective_action'
  // = الإجراءات التصحيحية (مصدرها تفتيش/حادث/بلاغ/مخالفة/خطر معاً - اعتماد إغلاقها حسّاس بما
  // يكفي لوحدة مستقلة)، 'hse_ppe' = معدات الوقاية الشخصية، 'hse_training' = التدريب والشهادات،
  // 'hse_hazmat' = المواد الخطرة، 'hse_emergency' = إجراءات الطوارئ ومعدات مكافحة الحريق معاً
  // (كلاهما "تجهيز/استجابة للطوارئ" وظيفياً). خطط السلامة نفسها (البند 1) لا تملك وحدة صلاحية
  // خاصة عمداً - تُدار عبر وحدة 'document' الموجودة أصلاً (pm_documents) لأنها فعلياً مستندات
  // بإصدارات واعتماد، تماماً كملاحظة equipment_inspections التي تُدار عبر 'safety' الموجودة.
  'hse_risk', 'hse_permit', 'hse_inspection', 'hse_incident', 'hse_corrective_action',
  'hse_ppe', 'hse_training', 'hse_hazmat', 'hse_emergency',
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
    equipment: E(true), equipment_operation: E(), equipment_maintenance: V(),
    equipment_spare_part: V(), equipment_operator: V(), equipment_rental: E(true),
    // رؤية محفظة على مستوى كل المشاريع - نفس مستوى quality: V()، safety: V() أعلاه تماماً.
    hse_risk: V(), hse_permit: V(), hse_inspection: V(), hse_incident: V(),
    hse_corrective_action: V(), hse_ppe: V(), hse_training: V(), hse_hazmat: V(), hse_emergency: V(),
  },

  project_manager: {
    project: E(true), phase: F(), task: F(true), team: F(), budget: E(),
    resource: E(), risk: F(), quality: E(), safety: E(), document: F(true),
    meeting: F(), report: F(), schedule: F(true),
    biz_client: V(), biz_opportunity: V(), biz_quote: V(), biz_contract: V(),
    biz_partner: V(), biz_work_order: E(true), biz_payment: V(),
    biz_correspondence: E(), biz_meeting: E(), biz_commitment: E(),
    equipment: E(true), equipment_operation: E(), equipment_maintenance: E(),
    equipment_spare_part: V(), equipment_operator: V(), equipment_rental: E(),
    hse_risk: E(), hse_permit: E(true), hse_inspection: E(), hse_incident: E(true),
    hse_corrective_action: E(true), hse_ppe: V(), hse_training: V(), hse_hazmat: V(), hse_emergency: E(),
  },

  // القسم الخامس: نظام الجدول الزمني - المؤلف الأساسي (WBS/العلاقات/المسار الحرج/الموارد/Baselines)
  planning_engineer: {
    project: V(), phase: V(), task: E(), team: V(), budget: NONE,
    resource: E(), risk: NONE, quality: NONE, safety: NONE, document: V(),
    meeting: V(), report: F(), schedule: F(true),
    biz_client: NONE, biz_opportunity: NONE, biz_quote: NONE, biz_contract: V(),
    biz_partner: NONE, biz_work_order: V(), biz_payment: NONE,
    biz_correspondence: NONE, biz_meeting: NONE, biz_commitment: NONE,
    equipment: V(), equipment_operation: V(), equipment_maintenance: NONE,
    equipment_spare_part: NONE, equipment_operator: NONE, equipment_rental: NONE,
  },

  // مهندس الموقع (القسم السابع - البند 14 و24 من مواصفة إدارة المعدات) يُطابق الدور العام
  // الموجود أصلاً 'engineer' بدل استحداث دور مطابق وظيفياً - يمنح صلاحيات تشغيلية واسعة.
  engineer: {
    project: V(), phase: V(), task: E(), team: V(), budget: V(),
    resource: V(), risk: E(), quality: E(), safety: V(), document: E(),
    meeting: V(), report: V(), schedule: E(),
    biz_client: NONE, biz_opportunity: NONE, biz_quote: V(), biz_contract: V(),
    biz_partner: V(), biz_work_order: E(), biz_payment: NONE,
    biz_correspondence: V(), biz_meeting: V(), biz_commitment: V(),
    equipment: V(), equipment_operation: E(), equipment_maintenance: E(),
    equipment_spare_part: V(), equipment_operator: V(), equipment_rental: V(),
    hse_risk: E(), hse_permit: E(), hse_inspection: E(), hse_incident: E(),
    hse_corrective_action: E(), hse_ppe: V(), hse_training: V(), hse_hazmat: V(), hse_emergency: V(),
  },

  supervisor: {
    project: V(), phase: V(), task: E(), team: E(), budget: V(),
    resource: E(), risk: V(), quality: E(), safety: E(), document: V(),
    meeting: V(), report: V(), schedule: E(),
    biz_client: NONE, biz_opportunity: NONE, biz_quote: NONE, biz_contract: NONE,
    biz_partner: V(), biz_work_order: E(), biz_payment: NONE,
    biz_correspondence: NONE, biz_meeting: V(), biz_commitment: V(),
    equipment: V(), equipment_operation: E(), equipment_maintenance: E(),
    equipment_spare_part: V(), equipment_operator: V(), equipment_rental: NONE,
    hse_risk: V(), hse_permit: E(), hse_inspection: E(), hse_incident: E(),
    hse_corrective_action: E(), hse_ppe: E(), hse_training: V(), hse_hazmat: V(), hse_emergency: V(),
  },

  accountant: {
    project: V(), phase: V(), task: V(), team: V(), budget: F(true),
    resource: V(), risk: V(), quality: NONE, safety: NONE, document: V(),
    meeting: NONE, report: E(), schedule: V(),
    biz_client: V(), biz_opportunity: NONE, biz_quote: V(), biz_contract: V(),
    biz_partner: V(), biz_work_order: V(), biz_payment: F(true),
    biz_correspondence: NONE, biz_meeting: NONE, biz_commitment: V(),
    equipment: V(), equipment_operation: V(), equipment_maintenance: V(),
    equipment_spare_part: V(), equipment_operator: NONE, equipment_rental: F(true),
  },

  quality_officer: {
    project: V(), phase: V(), task: V(), team: V(), budget: NONE,
    resource: V(), risk: E(), quality: F(true), safety: V(), document: E(),
    meeting: V(), report: E(), schedule: V(),
    biz_client: NONE, biz_opportunity: NONE, biz_quote: NONE, biz_contract: NONE,
    biz_partner: E(), biz_work_order: V(), biz_payment: NONE,
    biz_correspondence: NONE, biz_meeting: NONE, biz_commitment: NONE,
    equipment: NONE, equipment_operation: NONE, equipment_maintenance: NONE,
    equipment_spare_part: NONE, equipment_operator: NONE, equipment_rental: NONE,
    // رؤية فقط على نتائج التفتيش والإجراءات التصحيحية (البند 14: ربط ملاحظات السلامة
    // بتقارير الجودة/NCR) - بلا صلاحية تعديل داخل قسم السلامة نفسه.
    hse_risk: NONE, hse_permit: NONE, hse_inspection: V(), hse_incident: NONE,
    hse_corrective_action: V(), hse_ppe: NONE, hse_training: NONE, hse_hazmat: NONE, hse_emergency: NONE,
  },

  // مسؤول السلامة: يبقى المسؤول الحصري عن فحوصات سلامة المعدات عبر وحدة 'safety' الموجودة
  // (equipment_inspections)، مع رؤية على سجل المعدات والمشغلين اللازمة لأداء هذا الدور.
  safety_officer: {
    project: V(), phase: V(), task: V(), team: V(), budget: NONE,
    resource: V(), risk: E(), quality: V(), safety: F(true), document: E(),
    meeting: V(), report: E(), schedule: V(),
    biz_client: NONE, biz_opportunity: NONE, biz_quote: NONE, biz_contract: NONE,
    biz_partner: E(), biz_work_order: V(), biz_payment: NONE,
    biz_correspondence: NONE, biz_meeting: NONE, biz_commitment: NONE,
    equipment: V(), equipment_operation: V(), equipment_maintenance: V(),
    equipment_spare_part: NONE, equipment_operator: V(), equipment_rental: NONE,
    // المالك التشغيلي اليومي لكل وحدات HSE - اعتماد كامل على كل شيء ما عدا التصاريح
    // (hse_permit تبقى E() بلا اعتماد نهائي: مخصص لـ hse_manager/project_manager - تدرّج
    // اعتماد واقعي للأعمال عالية الخطورة كاللحام/الأماكن المغلقة، وليس تناقضاً في الصلاحيات).
    hse_risk: F(true), hse_permit: E(), hse_inspection: F(true), hse_incident: F(true),
    hse_corrective_action: F(true), hse_ppe: F(true), hse_training: F(true),
    hse_hazmat: F(true), hse_emergency: F(true),
  },

  client: {
    project: V(), phase: V(true), task: V(), team: NONE, budget: NONE,
    resource: NONE, risk: NONE, quality: NONE, safety: NONE, document: V(true),
    meeting: V(), report: V(), schedule: V(),
    biz_client: NONE, biz_opportunity: NONE, biz_quote: V(), biz_contract: V(),
    biz_partner: NONE, biz_work_order: V(), biz_payment: V(),
    biz_correspondence: V(), biz_meeting: V(), biz_commitment: NONE,
    equipment: V(), equipment_operation: NONE, equipment_maintenance: NONE,
    equipment_spare_part: NONE, equipment_operator: NONE, equipment_rental: NONE,
    // رؤية على أداء السلامة العام (تفتيش/حوادث) لأنه غالباً متطلب تعاقدي/تنظيمي شفاف
    // للعميل - بعكس تفاصيل الجودة الداخلية البحتة (quality: NONE أعلاه تبقى كما هي).
    hse_risk: NONE, hse_permit: NONE, hse_inspection: V(), hse_incident: V(),
    hse_corrective_action: NONE, hse_ppe: NONE, hse_training: NONE, hse_hazmat: NONE, hse_emergency: NONE,
  },

  technician: {
    project: V(), phase: V(), task: E(), team: NONE, budget: NONE,
    resource: V(), risk: V(), quality: V(), safety: V(), document: V(),
    meeting: NONE, report: NONE, schedule: E(),
    biz_client: NONE, biz_opportunity: NONE, biz_quote: NONE, biz_contract: NONE,
    biz_partner: NONE, biz_work_order: V(), biz_payment: NONE,
    biz_correspondence: NONE, biz_meeting: NONE, biz_commitment: NONE,
    equipment: V(), equipment_operation: V(), equipment_maintenance: E(),
    equipment_spare_part: E(), equipment_operator: NONE, equipment_rental: NONE,
  },

  worker: {
    project: NONE, phase: NONE, task: E(), team: NONE, budget: NONE,
    resource: NONE, risk: NONE, quality: NONE, safety: V(), document: NONE,
    meeting: NONE, report: NONE, schedule: E(),
    biz_client: NONE, biz_opportunity: NONE, biz_quote: NONE, biz_contract: NONE,
    biz_partner: NONE, biz_work_order: NONE, biz_payment: NONE,
    biz_correspondence: NONE, biz_meeting: NONE, biz_commitment: NONE,
    equipment: NONE, equipment_operation: NONE, equipment_maintenance: NONE,
    equipment_spare_part: NONE, equipment_operator: NONE, equipment_rental: NONE,
    // hse_incident: E() قصداً (وليس V()) - يسمح للعامل بالإبلاغ عن حادث/بلاغ قريب من حادث
    // (ثقافة إبلاغ بلا لوم، مبدأ سلامة معروف)؛ app/api/hse/incidents يقيّد التعديل لاحقاً على
    // سجلاته هو فقط (نفس فكرة تقييد "عملياته فقط" في equipment_operation للمشغل operator).
    hse_risk: NONE, hse_permit: NONE, hse_inspection: NONE, hse_incident: E(),
    hse_corrective_action: NONE, hse_ppe: V(), hse_training: V(), hse_hazmat: NONE, hse_emergency: V(),
  },

  contractor_rep: {
    project: V(), phase: V(), task: V(), team: NONE, budget: NONE,
    resource: V(), risk: V(), quality: V(), safety: V(), document: E(),
    meeting: V(), report: V(), schedule: V(),
    biz_client: NONE, biz_opportunity: NONE, biz_quote: NONE, biz_contract: NONE,
    biz_partner: V(), biz_work_order: V(), biz_payment: NONE,
    biz_correspondence: E(), biz_meeting: V(), biz_commitment: V(),
    equipment: V(), equipment_operation: V(), equipment_maintenance: NONE,
    equipment_spare_part: NONE, equipment_operator: NONE, equipment_rental: NONE,
    hse_risk: V(), hse_permit: E(), hse_inspection: V(), hse_incident: E(),
    hse_corrective_action: V(), hse_ppe: NONE, hse_training: V(), hse_hazmat: V(), hse_emergency: V(),
  },

  supplier_rep: {
    project: V(), phase: NONE, task: V(), team: NONE, budget: NONE,
    resource: E(), risk: NONE, quality: NONE, safety: NONE, document: E(),
    meeting: NONE, report: NONE, schedule: V(),
    biz_client: NONE, biz_opportunity: NONE, biz_quote: NONE, biz_contract: NONE,
    biz_partner: V(), biz_work_order: V(), biz_payment: NONE,
    biz_correspondence: E(), biz_meeting: NONE, biz_commitment: V(),
    equipment: NONE, equipment_operation: NONE, equipment_maintenance: NONE,
    equipment_spare_part: E(), equipment_operator: NONE, equipment_rental: V(),
  },

  consultant_rep: {
    project: V(), phase: V(), task: V(), team: NONE, budget: NONE,
    resource: V(), risk: V(), quality: E(true), safety: V(), document: E(true),
    meeting: V(), report: V(), schedule: V(),
    biz_client: NONE, biz_opportunity: NONE, biz_quote: V(), biz_contract: V(),
    biz_partner: V(), biz_work_order: V(), biz_payment: NONE,
    biz_correspondence: V(), biz_meeting: V(), biz_commitment: V(),
    equipment: V(), equipment_operation: V(), equipment_maintenance: V(),
    equipment_spare_part: NONE, equipment_operator: NONE, equipment_rental: NONE,
  },

  // ============ القسم السادس: نظام إدارة الأعمال - ثلاثة أدوار جديدة (البند 17) ============

  business_manager: {
    project: V(), phase: V(), task: E(), team: NONE, budget: E(),
    resource: NONE, risk: V(), quality: NONE, safety: NONE, document: E(true),
    meeting: E(), report: F(), schedule: V(),
    biz_client: F(true), biz_opportunity: F(true), biz_quote: F(true), biz_contract: F(true),
    biz_partner: F(true), biz_work_order: F(true), biz_payment: F(true),
    biz_correspondence: F(true), biz_meeting: F(true), biz_commitment: F(true),
    equipment: V(), equipment_operation: NONE, equipment_maintenance: NONE,
    equipment_spare_part: NONE, equipment_operator: NONE, equipment_rental: E(true),
  },

  contracts_officer: {
    project: V(), phase: NONE, task: NONE, team: NONE, budget: V(),
    resource: NONE, risk: NONE, quality: NONE, safety: NONE, document: E(true),
    meeting: V(), report: E(), schedule: NONE,
    biz_client: V(), biz_opportunity: V(), biz_quote: V(), biz_contract: F(true),
    biz_partner: V(), biz_work_order: V(), biz_payment: E(true),
    biz_correspondence: E(), biz_meeting: V(), biz_commitment: F(true),
    equipment: NONE, equipment_operation: NONE, equipment_maintenance: NONE,
    equipment_spare_part: NONE, equipment_operator: NONE, equipment_rental: F(true),
  },

  procurement_officer: {
    project: V(), phase: NONE, task: NONE, team: NONE, budget: NONE,
    resource: E(), risk: NONE, quality: NONE, safety: NONE, document: E(),
    meeting: V(), report: E(), schedule: NONE,
    biz_client: NONE, biz_opportunity: NONE, biz_quote: NONE, biz_contract: V(),
    biz_partner: F(true), biz_work_order: E(true), biz_payment: V(),
    biz_correspondence: E(), biz_meeting: V(), biz_commitment: E(),
    equipment: NONE, equipment_operation: NONE, equipment_maintenance: NONE,
    equipment_spare_part: E(), equipment_operator: NONE, equipment_rental: E(true),
    // رؤية فقط لتخطيط إعادة الطلب عند انخفاض مخزون الوقاية/نفاد المواد الخطرة.
    hse_risk: NONE, hse_permit: NONE, hse_inspection: NONE, hse_incident: NONE,
    hse_corrective_action: NONE, hse_ppe: V(), hse_training: NONE, hse_hazmat: V(), hse_emergency: NONE,
  },

  // ============ القسم السابع: نظام إدارة المعدات - أربعة أدوار جديدة (البند 24) ============

  // مدير المعدات: مالك القسم السابع بالكامل - صلاحية كاملة + اعتماد على كل وحدات المعدات، مع
  // رؤية/تعديل معتدلة على وحدات القسم الرابع ذات الصلة اللازمة للتكامل الحقيقي (البند 22:
  // تشغيل معدة → تسجيل ساعات → تحديث تكلفة → ظهور في ميزانية المشروع → ظهور في التقارير).
  equipment_manager: {
    project: V(), phase: NONE, task: NONE, team: NONE, budget: V(),
    resource: V(), risk: NONE, quality: NONE, safety: V(), document: E(),
    meeting: NONE, report: F(), schedule: V(),
    biz_client: NONE, biz_opportunity: NONE, biz_quote: NONE, biz_contract: NONE,
    biz_partner: V(), biz_work_order: NONE, biz_payment: NONE,
    biz_correspondence: NONE, biz_meeting: NONE, biz_commitment: NONE,
    equipment: F(true), equipment_operation: F(true), equipment_maintenance: F(true),
    equipment_spare_part: F(true), equipment_operator: F(true), equipment_rental: F(true),
    // رؤية فقط على حوادث HSE (البند 13: تكامل السلامة مع المعدات) لمعرفة تورّط معداته.
    hse_risk: NONE, hse_permit: NONE, hse_inspection: NONE, hse_incident: V(),
    hse_corrective_action: NONE, hse_ppe: NONE, hse_training: NONE, hse_hazmat: NONE, hse_emergency: NONE,
  },

  // مسؤول الصيانة: صلاحية كاملة واعتماد على الصيانة الوقائية/التصحيحية والأعطال (البند 10-12)،
  // وتعديل على سجل المعدات وقطع الغيار وسجلات التشغيل اللازمة لتقييم حالة المعدة قبل الإصلاح.
  maintenance_officer: {
    project: V(), phase: NONE, task: NONE, team: NONE, budget: NONE,
    resource: NONE, risk: NONE, quality: NONE, safety: V(), document: E(),
    meeting: NONE, report: E(), schedule: NONE,
    biz_client: NONE, biz_opportunity: NONE, biz_quote: NONE, biz_contract: NONE,
    biz_partner: NONE, biz_work_order: NONE, biz_payment: NONE,
    biz_correspondence: NONE, biz_meeting: NONE, biz_commitment: NONE,
    equipment: E(), equipment_operation: E(), equipment_maintenance: F(true),
    equipment_spare_part: E(), equipment_operator: V(), equipment_rental: NONE,
  },

  // أمين المخزن: صلاحية كاملة على مخزون قطع الغيار حصراً (البند 13: تنبيه انخفاض المخزون)،
  // مع رؤية فقط على بقية وحدات المعدات - يمنع تعديل ساعات التشغيل أو التكاليف (البند 28).
  warehouse_keeper: {
    project: NONE, phase: NONE, task: NONE, team: NONE, budget: NONE,
    resource: E(), risk: NONE, quality: NONE, safety: NONE, document: NONE,
    meeting: NONE, report: V(), schedule: NONE,
    biz_client: NONE, biz_opportunity: NONE, biz_quote: NONE, biz_contract: NONE,
    biz_partner: NONE, biz_work_order: NONE, biz_payment: NONE,
    biz_correspondence: NONE, biz_meeting: NONE, biz_commitment: NONE,
    equipment: V(), equipment_operation: NONE, equipment_maintenance: V(),
    equipment_spare_part: F(true), equipment_operator: NONE, equipment_rental: NONE,
    // مخزون معدات الوقاية عملياً في عهدة أمين المخزن نفسه - نفس منطق equipment_spare_part.
    hse_risk: NONE, hse_permit: NONE, hse_inspection: NONE, hse_incident: NONE,
    hse_corrective_action: NONE, hse_ppe: E(), hse_training: NONE, hse_hazmat: V(), hse_emergency: NONE,
  },

  // المشغل: يسجّل تشغيله ووقوده الخاص فقط على المعدة المصرَّح له بها (تعديل)، بلا أي صلاحية
  // إدارية أو مالية - يمنع تعديل ساعات التشغيل أو التكاليف من غير المخوَّل صراحة (البند 28).
  operator: {
    project: V(), phase: NONE, task: NONE, team: NONE, budget: NONE,
    resource: NONE, risk: NONE, quality: NONE, safety: V(), document: NONE,
    meeting: NONE, report: NONE, schedule: NONE,
    biz_client: NONE, biz_opportunity: NONE, biz_quote: NONE, biz_contract: NONE,
    biz_partner: NONE, biz_work_order: NONE, biz_payment: NONE,
    biz_correspondence: NONE, biz_meeting: NONE, biz_commitment: NONE,
    equipment: V(), equipment_operation: E(), equipment_maintenance: V(),
    equipment_spare_part: NONE, equipment_operator: NONE, equipment_rental: NONE,
  },

  // القسم الثامن: نظام إدارة السلامة المهنية - سلطة كاملة على وحدات HSE التسع (بما فيها
  // الاعتماد النهائي لتصاريح العمل وإغلاق الحوادث)، بنفس منطق equipment_manager تماماً.
  // document: E(true) لأن خطط/سياسات السلامة تُدار عبر pm_documents (انظر ملاحظة MODULES).
  hse_manager: {
    project: V(), phase: NONE, task: NONE, team: V(), budget: NONE,
    resource: V(), risk: E(), quality: V(), safety: F(true), document: E(true),
    meeting: V(), report: F(), schedule: V(),
    biz_client: NONE, biz_opportunity: NONE, biz_quote: NONE, biz_contract: NONE,
    biz_partner: NONE, biz_work_order: NONE, biz_payment: NONE,
    biz_correspondence: NONE, biz_meeting: NONE, biz_commitment: NONE,
    equipment: V(), equipment_operation: V(), equipment_maintenance: V(),
    equipment_spare_part: V(), equipment_operator: V(), equipment_rental: NONE,
    hse_risk: F(true), hse_permit: F(true), hse_inspection: F(true), hse_incident: F(true),
    hse_corrective_action: F(true), hse_ppe: F(true), hse_training: F(true),
    hse_hazmat: F(true), hse_emergency: F(true),
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
