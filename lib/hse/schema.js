// lib/hse/schema.js
// =============================================================================
// القسم الثامن: نظام إدارة السلامة المهنية (Occupational Health & Safety Management System)
// — طبقة المخطط.
//
// يتبع بالضبط نفس نمط lib/equipment/schema.js (والموسّع بدوره من lib/pm/schema.js):
// يعيد استخدام اتصال SQLite الموحّد (lib/db.js:getDb) - "قاعدة بيانات مركزية واحدة" حرفياً
// (الوثيقة الأولى، قسم "التكامل"؛ الوثيقة الثانية، البند 1). لا يُعدَّل lib/db.js إطلاقاً
// (صفر أثر على الأقسام 1-7 العاملة فعلياً). كل جداول هذا القسم ببادئة `hse_`، تُنشأ فقط عند
// أول استدعاء فعلي لأي مسار API في هذا القسم (lazy، idempotent عبر IF NOT EXISTS).
//
// الربط بالمشروع يتم عبر `project_id INTEGER REFERENCES projects(id)` مباشرة - نفس أسلوب
// equipment_assets/pm_tasks تماماً؛ projects نفسه يُنشأ في lib/db.js فيكون موجوداً دوماً.
//
// قرار تصميم مقصود ("عدم تكرار البيانات" - الوثيقة الثانية، البند 25 والبند 1): بدل اختراع
// جداول HSE موازية لِما هو موجود فعلاً، يعيد هذا القسم استخدام:
//  - pm_documents/pm_document_versions (lib/pm/db/documents.js + lib/pm/fileStorage.js) لخطط
//    السلامة/السياسات/الإجراءات كملفات رسمية بإصدارات واعتماد حقيقيين (بدل جدول HSE منفصل بلا
//    فائدة إضافية) - عبر تصنيفات category تبدأ بـ 'hse_' فقط (انظر HSE_DOCUMENT_CATEGORIES بالأسفل).
//  - biz_approvals (lib/business/db/approvals.js) لسجل قرارات اعتماد التصاريح/إغلاق الحوادث
//    (entity_type='hse_permit'|'hse_incident_closure'|'hse_corrective_action') بدل جدول اعتماد
//    HSE منفصل بنفس الأعمدة الخمسة تماماً.
//  - lib/pm/fileStorage.js (saveUploadedFile) لتخزين صور/فيديوهات/مرفقات الحوادث والتفتيش
//    وبطاقات SDS فعلياً على القرص (data/pm-uploads/<project_id>/) بدل نظام رفع منفصل.
//  - equipment_assets/equipment_inspections (قراءة فقط) للتكامل الحقيقي مع قسم المعدات
//    (البند 13) - وequipment_id/linked_ncr_id أدناه أعمدة INTEGER عادية بلا REFERENCES قصداً
//    (بلا قيد FK بين الأقسام) لتفادي أي ترابط في ترتيب إنشاء المخططات بين الأقسام: قسم HSE قد
//    يُستخدم لأول مرة في نشر جديد قبل زيارة أي مسار equipment/quality على الإطلاق، والتحقق من
//    وجود السجل المرتبط فعلياً يتم في طبقة lib/hse/db (وليس في القيد الخام) - القيد الصارم مع
//    PRAGMA foreign_keys=ON المفعّل في lib/db.js كان سيكسر هذا السيناريو.
// =============================================================================

import { getDb } from '../db.js';

const globalForHse = globalThis;

function createHseTables(db) {
  db.exec(`
    -- ============== مواقع العمل (الوثيقة الثانية، البند 2) ==============
    CREATE TABLE IF NOT EXISTS hse_sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      location TEXT,
      operational_zones TEXT,
      current_activities TEXT,
      key_hazards TEXT,
      safety_officer TEXT,
      site_status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_hse_sites_project ON hse_sites(project_id);

    -- ============== سجل المخاطر ومصفوفة التقييم (البند 3 والبند 4) ==============
    CREATE TABLE IF NOT EXISTS hse_risks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      risk_no TEXT NOT NULL UNIQUE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      site_id INTEGER REFERENCES hse_sites(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT,
      location TEXT,
      activity TEXT,
      category TEXT NOT NULL DEFAULT 'other',
      cause TEXT,
      -- التقييم الأولي (يُحفظ ثابتاً عند الإنشاء ليُقارَن لاحقاً بإعادة التقييم بعد التحكم)
      initial_likelihood INTEGER NOT NULL,
      initial_severity INTEGER NOT NULL,
      initial_score INTEGER NOT NULL,
      initial_level TEXT NOT NULL,
      -- التقييم الحالي (يتحدّث مع كل إعادة تقييم - نفس منطق equipment_assets.status الحالي مقابل
      -- equipment_status_log التاريخي)
      likelihood INTEGER NOT NULL,
      severity INTEGER NOT NULL,
      risk_score INTEGER NOT NULL,
      risk_level TEXT NOT NULL,
      control_measures TEXT,
      responsible TEXT,
      review_date TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_hse_risks_project ON hse_risks(project_id);
    CREATE INDEX IF NOT EXISTS idx_hse_risks_status ON hse_risks(status);
    CREATE INDEX IF NOT EXISTS idx_hse_risks_level ON hse_risks(risk_level);

    CREATE TABLE IF NOT EXISTS hse_risk_reassessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      risk_id INTEGER NOT NULL REFERENCES hse_risks(id) ON DELETE CASCADE,
      likelihood INTEGER NOT NULL,
      severity INTEGER NOT NULL,
      risk_score INTEGER NOT NULL,
      risk_level TEXT NOT NULL,
      note TEXT,
      assessed_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_hse_risk_reassess_risk ON hse_risk_reassessments(risk_id);

    -- ============== الإجراءات التصحيحية (البند 12) - جدول عام واحد يخدم كل مصادر الملاحظات
    -- (تفتيش/حادث/بلاغ قريب من حادث/مخالفة/خطر) بدل تكرار نفس الأعمدة الست في كل مصدر - نفس
    -- مبدأ biz_approvals تماماً. source_id عمود عادي بلا REFERENCES لأن الجدول المصدر يختلف
    -- باختلاف source_type (ارتباط متعدد الأشكال polymorphic association) فلا يمكن أن يشير عمود
    -- واحد بقيد FK صارم إلى جداول مختلفة معاً؛ سلامة الإشارة تُضمن في lib/hse/db/correctiveActions.js
    -- (كل دالة create* تتحقق من وجود السجل المصدر فعلياً قبل الإدراج).
    CREATE TABLE IF NOT EXISTS hse_corrective_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      action_no TEXT NOT NULL UNIQUE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      source_type TEXT NOT NULL,
      source_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      responsible TEXT,
      due_date TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      completion_pct INTEGER NOT NULL DEFAULT 0,
      closure_evidence TEXT,
      -- لا تُعتبر الملاحظة مغلقة إلا بعد اعتماد المسؤول (البند 12 حرفياً) - closed_at/closed_by
      -- تبقى NULL حتى تمر عبر approveCorrectiveAction() في db/correctiveActions.js
      approved_by TEXT,
      approved_at TEXT,
      closed_at TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_hse_ca_project ON hse_corrective_actions(project_id);
    CREATE INDEX IF NOT EXISTS idx_hse_ca_status ON hse_corrective_actions(status);
    CREATE INDEX IF NOT EXISTS idx_hse_ca_source ON hse_corrective_actions(source_type, source_id);

    -- ============== قوائم تحقق قابلة للتخصيص (البند 6) ==============
    CREATE TABLE IF NOT EXISTS hse_checklist_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      items_json TEXT NOT NULL DEFAULT '[]',
      is_default INTEGER NOT NULL DEFAULT 0,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ============== التفتيشات الميدانية (البند 6) - تفتيش عام للموقع (سقالات/تدبير منزلي/
    -- امتثال معدات الوقاية...) - مختلف عن equipment_inspections (فحص سلامة تشغيل معدة واحدة قبل
    -- الاستخدام، قسم 7) وإن كان بند تفتيش هنا قد يُشير لمعدة بعينها عبر عمود equipment_id على
    -- hse_inspection_items أدناه.
    CREATE TABLE IF NOT EXISTS hse_inspections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      inspection_no TEXT NOT NULL UNIQUE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      site_id INTEGER REFERENCES hse_sites(id) ON DELETE SET NULL,
      template_id INTEGER REFERENCES hse_checklist_templates(id) ON DELETE SET NULL,
      related_inspection_id INTEGER REFERENCES hse_inspections(id) ON DELETE SET NULL,
      inspection_type TEXT NOT NULL DEFAULT 'general_safety_walk',
      inspector TEXT,
      inspection_date TEXT NOT NULL,
      location TEXT,
      overall_result TEXT NOT NULL DEFAULT 'pending',
      status TEXT NOT NULL DEFAULT 'draft',
      notes TEXT,
      approved_by TEXT,
      approved_at TEXT,
      closed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_hse_inspections_project ON hse_inspections(project_id);
    CREATE INDEX IF NOT EXISTS idx_hse_inspections_date ON hse_inspections(inspection_date);
    CREATE INDEX IF NOT EXISTS idx_hse_inspections_status ON hse_inspections(status);

    CREATE TABLE IF NOT EXISTS hse_inspection_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inspection_id INTEGER NOT NULL REFERENCES hse_inspections(id) ON DELETE CASCADE,
      item_text TEXT NOT NULL,
      category TEXT,
      is_compliant INTEGER,
      severity TEXT,
      note TEXT,
      responsible TEXT,
      due_date TEXT,
      equipment_id INTEGER,
      corrective_action_id INTEGER REFERENCES hse_corrective_actions(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_hse_inspect_items_inspection ON hse_inspection_items(inspection_id);

    -- ============== تصاريح العمل Permit to Work (البند 5) ==============
    CREATE TABLE IF NOT EXISTS hse_permits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      permit_no TEXT NOT NULL UNIQUE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      site_id INTEGER REFERENCES hse_sites(id) ON DELETE SET NULL,
      permit_type TEXT NOT NULL,
      activity TEXT,
      location TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      responsible TEXT,
      team_members TEXT,
      equipment_id INTEGER,
      linked_risk_id INTEGER REFERENCES hse_risks(id) ON DELETE SET NULL,
      required_ppe TEXT,
      safety_conditions TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_by TEXT,
      closed_by TEXT,
      closed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_hse_permits_project ON hse_permits(project_id);
    CREATE INDEX IF NOT EXISTS idx_hse_permits_status ON hse_permits(status);
    CREATE INDEX IF NOT EXISTS idx_hse_permits_enddate ON hse_permits(end_date);

    -- ============== الحوادث والإصابات (البند 7) ==============
    CREATE TABLE IF NOT EXISTS hse_incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      incident_no TEXT NOT NULL UNIQUE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      site_id INTEGER REFERENCES hse_sites(id) ON DELETE SET NULL,
      incident_type TEXT NOT NULL,
      incident_date TEXT NOT NULL,
      incident_time TEXT,
      location TEXT,
      affected_persons TEXT NOT NULL DEFAULT '[]',
      description TEXT,
      immediate_cause TEXT,
      root_cause TEXT,
      witnesses TEXT,
      damages_description TEXT,
      immediate_actions TEXT,
      investigation_notes TEXT,
      investigation_status TEXT NOT NULL DEFAULT 'pending',
      status TEXT NOT NULL DEFAULT 'reported',
      equipment_id INTEGER,
      linked_ncr_id INTEGER,
      reported_by TEXT,
      closed_by TEXT,
      closed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_hse_incidents_project ON hse_incidents(project_id);
    CREATE INDEX IF NOT EXISTS idx_hse_incidents_date ON hse_incidents(incident_date);
    CREATE INDEX IF NOT EXISTS idx_hse_incidents_status ON hse_incidents(status);

    -- ============== البلاغات القريبة من الحوادث Near Miss (البند 8) ==============
    CREATE TABLE IF NOT EXISTS hse_near_misses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      near_miss_no TEXT NOT NULL UNIQUE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      site_id INTEGER REFERENCES hse_sites(id) ON DELETE SET NULL,
      description TEXT NOT NULL,
      location TEXT,
      activity TEXT,
      risk_level TEXT NOT NULL DEFAULT 'low',
      cause TEXT,
      preventive_actions TEXT,
      responsible TEXT,
      linked_risk_id INTEGER REFERENCES hse_risks(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'open',
      reported_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_hse_nearmiss_project ON hse_near_misses(project_id);
    CREATE INDEX IF NOT EXISTS idx_hse_nearmiss_status ON hse_near_misses(status);

    -- ============== المخالفات (الوثيقة الأولى، قسم "إدارة المخالفات") ==============
    CREATE TABLE IF NOT EXISTS hse_violations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      violation_no TEXT NOT NULL UNIQUE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      site_id INTEGER REFERENCES hse_sites(id) ON DELETE SET NULL,
      violation_type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'medium',
      responsible_person TEXT,
      location TEXT,
      violation_date TEXT NOT NULL,
      due_date TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      reported_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_hse_violations_project ON hse_violations(project_id);
    CREATE INDEX IF NOT EXISTS idx_hse_violations_status ON hse_violations(status);

    -- ============== معدات الوقاية الشخصية PPE (البند 9) ==============
    CREATE TABLE IF NOT EXISTS hse_ppe_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_type TEXT NOT NULL,
      item_name TEXT NOT NULL,
      unit TEXT NOT NULL DEFAULT 'قطعة',
      quantity_on_hand INTEGER NOT NULL DEFAULT 0,
      min_stock INTEGER NOT NULL DEFAULT 0,
      default_lifespan_days INTEGER,
      unit_cost REAL NOT NULL DEFAULT 0,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS hse_ppe_distributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      ppe_item_id INTEGER NOT NULL REFERENCES hse_ppe_items(id) ON DELETE CASCADE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      team_member_id INTEGER,
      employee_name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      issue_date TEXT NOT NULL,
      expiry_date TEXT,
      replacement_date TEXT,
      condition TEXT NOT NULL DEFAULT 'good',
      status TEXT NOT NULL DEFAULT 'issued',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_hse_ppe_dist_project ON hse_ppe_distributions(project_id);
    CREATE INDEX IF NOT EXISTS idx_hse_ppe_dist_item ON hse_ppe_distributions(ppe_item_id);
    CREATE INDEX IF NOT EXISTS idx_hse_ppe_dist_expiry ON hse_ppe_distributions(expiry_date);

    -- ============== التدريب والشهادات (البند 10) ==============
    CREATE TABLE IF NOT EXISTS hse_training_courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      course_name TEXT NOT NULL,
      provider TEXT,
      category TEXT,
      course_date TEXT NOT NULL,
      validity_days INTEGER,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS hse_training_certifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      course_id INTEGER NOT NULL REFERENCES hse_training_courses(id) ON DELETE CASCADE,
      team_member_id INTEGER,
      trainee_name TEXT NOT NULL,
      certificate_no TEXT,
      issued_date TEXT NOT NULL,
      expiry_date TEXT,
      evaluation_score REAL,
      status TEXT NOT NULL DEFAULT 'valid',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_hse_certs_course ON hse_training_certifications(course_id);
    CREATE INDEX IF NOT EXISTS idx_hse_certs_expiry ON hse_training_certifications(expiry_date);

    -- ============== المواد الخطرة (الوثيقة الأولى، قسم "إدارة المواد الخطرة") ==============
    CREATE TABLE IF NOT EXISTS hse_hazmat_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      material_name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'other',
      storage_location TEXT,
      transport_method TEXT,
      usage_instructions TEXT,
      required_ppe TEXT,
      emergency_procedures TEXT,
      disposal_method TEXT,
      quantity_on_hand REAL,
      unit TEXT,
      sds_attachment_id INTEGER,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_hse_hazmat_project ON hse_hazmat_materials(project_id);

    -- ============== معدات مكافحة الحريق (الوثيقة الأولى، قسم "إدارة معدات مكافحة الحريق") ==============
    CREATE TABLE IF NOT EXISTS hse_fire_equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      equipment_type TEXT NOT NULL,
      type_detail TEXT,
      location TEXT,
      install_date TEXT,
      last_inspection_date TEXT,
      next_inspection_date TEXT,
      expiry_date TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_hse_fire_eq_project ON hse_fire_equipment(project_id);
    CREATE INDEX IF NOT EXISTS idx_hse_fire_eq_next_insp ON hse_fire_equipment(next_inspection_date);

    CREATE TABLE IF NOT EXISTS hse_fire_equipment_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fire_equipment_id INTEGER NOT NULL REFERENCES hse_fire_equipment(id) ON DELETE CASCADE,
      check_date TEXT NOT NULL,
      result TEXT NOT NULL DEFAULT 'pass',
      notes TEXT,
      inspected_by TEXT,
      next_due_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_hse_fire_checks_eq ON hse_fire_equipment_checks(fire_equipment_id);

    -- ============== إدارة الطوارئ (البند 11) ==============
    CREATE TABLE IF NOT EXISTS hse_emergency_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      plan_type TEXT NOT NULL DEFAULT 'general',
      title TEXT NOT NULL,
      scenario TEXT,
      assembly_points TEXT,
      emergency_contacts TEXT,
      linked_document_id INTEGER,
      is_active INTEGER NOT NULL DEFAULT 1,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_hse_emerg_plans_project ON hse_emergency_plans(project_id);

    CREATE TABLE IF NOT EXISTS hse_emergency_teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      team_name TEXT NOT NULL,
      team_type TEXT NOT NULL DEFAULT 'evacuation',
      members TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_hse_emerg_teams_project ON hse_emergency_teams(project_id);

    CREATE TABLE IF NOT EXISTS hse_emergency_drills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      plan_id INTEGER REFERENCES hse_emergency_plans(id) ON DELETE SET NULL,
      drill_date TEXT NOT NULL,
      scenario TEXT,
      participants_count INTEGER,
      response_time_minutes REAL,
      evaluation_notes TEXT,
      evaluator TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_hse_drills_project ON hse_emergency_drills(project_id);

    -- ============== مرفقات عامة (صور/فيديوهات/مستندات) - جدول واحد متعدد الأشكال يخدم كل
    -- الكيانات (حادث/بلاغ قريب من حادث/تفتيش/مخالفة/تصريح/مادة خطرة/خطر) بدل عمود ملف مكرر
    -- في كل جدول أعلاه - نفس مبدأ hse_corrective_actions تماماً ==============
    CREATE TABLE IF NOT EXISTS hse_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL DEFAULT 0,
      mime_type TEXT,
      original_name TEXT,
      uploaded_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_hse_attach_entity ON hse_attachments(entity_type, entity_id);

    -- ============== التنبيهات الذكية (البند 18) ==============
    CREATE TABLE IF NOT EXISTS hse_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      title TEXT NOT NULL,
      message TEXT,
      related_entity_type TEXT,
      related_entity_id INTEGER,
      dedup_key TEXT NOT NULL UNIQUE,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_hse_notif_project ON hse_notifications(project_id);
    CREATE INDEX IF NOT EXISTS idx_hse_notif_read ON hse_notifications(is_read);

    -- ============== سجل التدقيق Audit Log (البند 22) ==============
    CREATE TABLE IF NOT EXISTS hse_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      action TEXT NOT NULL,
      before_json TEXT,
      after_json TEXT,
      actor TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_hse_audit_entity ON hse_audit_log(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_hse_audit_project ON hse_audit_log(project_id);

    -- ============== سجل التقارير المُصدَّرة (البند 19) ==============
    CREATE TABLE IF NOT EXISTS hse_report_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      report_type TEXT NOT NULL,
      format TEXT NOT NULL,
      generated_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function ensureHseSchema() {
  if (globalForHse.__hseSchemaReady) return;
  const db = getDb();
  createHseTables(db);
  globalForHse.__hseSchemaReady = true;
}

/** يُعيد اتصال قاعدة البيانات الموحّد، بعد التأكد من جاهزية مخطط القسم الثامن (idempotent). */
export function hdb() {
  ensureHseSchema();
  return getDb();
}

// ثوابت الحالات المستخدمة عبر وحدات القسم الثامن - مصدر واحد لتفادي تكرارها (نفس أسلوب
// equipment/schema.js وpm/schema.js).
export const SITE_STATUSES = ['active', 'suspended', 'closed'];

export const RISK_CATEGORIES = [
  'fall', 'electrical', 'fire', 'chemical', 'mechanical', 'ergonomic',
  'environmental', 'vehicle_traffic', 'excavation', 'lifting', 'confined_space', 'other',
];
// مصفوفة تقييم المخاطر (البند 4): الدرجة = الاحتمالية × الشدة (1-5 لكل منهما، فتقع الدرجة بين
// 1 و25) مقسّمة لأربع نطاقات - نفس النطاقات المحسوبة في lib/hse/riskMatrix.js حرفياً (مصدر واحد).
export const RISK_LEVELS = ['low', 'medium', 'high', 'critical'];
export const RISK_STATUSES = ['open', 'mitigating', 'reassessed', 'closed'];

export const PERMIT_TYPES = [
  'working_at_height', 'confined_space', 'hot_work', 'electrical',
  'excavation', 'lifting', 'hazardous_materials', 'maintenance',
];
export const PERMIT_STATUSES = ['draft', 'pending_approval', 'approved', 'active', 'expired', 'closed', 'rejected', 'cancelled'];

export const INSPECTION_TYPES = ['general_safety_walk', 'scaffolding', 'ppe_compliance', 'housekeeping', 'fire_safety', 'electrical_safety', 'excavation', 'custom'];
export const INSPECTION_OVERALL_RESULTS = ['pending', 'compliant', 'non_compliant', 'pass_with_notes'];
export const INSPECTION_STATUSES = ['draft', 'completed', 'approved', 'closed'];
export const FINDING_SEVERITIES = ['minor', 'moderate', 'major', 'critical'];

export const INCIDENT_TYPES = ['fatality', 'lost_time_injury', 'medical_treatment_injury', 'first_aid_injury', 'property_damage', 'environmental', 'fire', 'vehicle_accident'];
export const INJURY_SEVERITIES = ['minor', 'moderate', 'severe', 'fatal'];
export const INCIDENT_STATUSES = ['reported', 'investigating', 'corrective_action', 'closed'];
export const INVESTIGATION_STATUSES = ['pending', 'in_progress', 'completed'];

export const NEAR_MISS_STATUSES = ['open', 'closed'];
export const VIOLATION_TYPES = ['ppe_noncompliance', 'unsafe_act', 'unsafe_condition', 'permit_violation', 'housekeeping', 'environmental', 'other'];
export const VIOLATION_STATUSES = ['open', 'closed'];

export const CORRECTIVE_ACTION_SOURCE_TYPES = ['inspection_item', 'incident', 'near_miss', 'violation', 'risk'];
export const CORRECTIVE_ACTION_STATUSES = ['open', 'in_progress', 'completed', 'verified', 'closed'];

export const PPE_TYPES = ['helmet', 'safety_boots', 'gloves', 'goggles', 'safety_harness', 'reflective_vest', 'respirator', 'ear_protection', 'protective_clothing'];
export const PPE_CONDITIONS = ['good', 'damaged', 'expired', 'replaced'];
export const PPE_DISTRIBUTION_STATUSES = ['issued', 'returned', 'replaced'];

export const TRAINING_STATUSES = ['valid', 'expired', 'revoked'];

export const HAZMAT_CATEGORIES = ['flammable', 'corrosive', 'toxic', 'reactive', 'oxidizing', 'biohazard', 'radioactive', 'other'];

export const FIRE_EQUIPMENT_TYPES = ['extinguisher', 'hose_reel', 'alarm_system', 'smoke_detector', 'emergency_exit', 'sprinkler_system'];
export const FIRE_EQUIPMENT_STATUSES = ['active', 'needs_service', 'expired', 'out_of_service'];
export const FIRE_CHECK_RESULTS = ['pass', 'fail'];

export const EMERGENCY_PLAN_TYPES = ['evacuation', 'fire', 'medical', 'chemical_spill', 'general'];
export const EMERGENCY_TEAM_TYPES = ['evacuation', 'first_aid', 'firefighting', 'rescue', 'incident_command'];

export const ATTACHMENT_ENTITY_TYPES = ['incident', 'near_miss', 'inspection', 'violation', 'permit', 'hazmat', 'risk'];

// تصنيفات مستندات pm_documents الخاصة بهذا القسم (البند 1: خطط/سياسات/إجراءات السلامة) - إعادة
// استخدام حقيقية لنظام المستندات والإصدارات الموجود فعلاً (lib/pm/db/documents.js) بدل تكراره.
export const HSE_DOCUMENT_CATEGORIES = [
  'hse_safety_plan', 'hse_policy', 'hse_procedure', 'hse_safe_work_instruction',
  'hse_evacuation_plan', 'hse_safety_map',
];
