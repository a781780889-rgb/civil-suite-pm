// lib/pm/schema.js
// =============================================================================
// القسم الرابع: نظام إدارة المشاريع (Project Management System) — طبقة المخطط.
//
// يعيد استخدام نفس اتصال SQLite الموحّد (lib/db.js:getDb) بدل فتح اتصال منفصل - هذا هو
// المقصود حرفياً بـ "قاعدة بيانات مركزية واحدة" في مواصفة القسم. لا يُعدَّل lib/db.js
// إطلاقاً (لتفادي أي تأثير على الأقسام 1-3 العاملة فعلياً)؛ بدلاً من ذلك:
//   - يوسّع هذا الملف جدول `projects` الموجود بأعمدة جديدة عبر ALTER TABLE ADD COLUMN
//     (idempotent - يتحقق من PRAGMA table_info أولاً)، لأن `projects` مصمّم أصلاً ليكون
//     "نواة موحّدة" تُبنى عليها بقية الأقسام (كما وثّق README القسم الثالث صراحة).
//   - يضيف جداول جديدة كلها ببادئة `pm_` (بنفس نمط `boq_*`)، معزولة تماماً عن غيرها.
// =============================================================================

import { getDb } from '../db.js';

const globalForPm = globalThis;

function migrateProjectsColumns(db) {
  const existing = new Set(db.prepare(`PRAGMA table_info(projects)`).all().map((c) => c.name));
  const newColumns = [
    ['project_code', `TEXT`],
    ['project_type', `TEXT`],
    ['description', `TEXT`],
    ['subcontractor_name', `TEXT`],
    ['project_manager_name', `TEXT`],
    ['client_name', `TEXT`],
    ['latitude', `REAL`],
    ['longitude', `REAL`],
    ['city', `TEXT`],
    ['country', `TEXT`],
    ['start_date', `TEXT`],
    ['end_date', `TEXT`],
    ['contract_value', `REAL NOT NULL DEFAULT 0`],
    ['budget', `REAL NOT NULL DEFAULT 0`],
    ['target_profit_pct', `REAL NOT NULL DEFAULT 0`],
    ['currency', `TEXT NOT NULL DEFAULT 'SAR'`],
    ['status', `TEXT NOT NULL DEFAULT 'planning'`],
    ['priority', `TEXT NOT NULL DEFAULT 'medium'`],
    ['cover_image_base64', `TEXT`],
    ['is_archived', `INTEGER NOT NULL DEFAULT 0`],
  ];
  for (const [name, type] of newColumns) {
    if (!existing.has(name)) {
      db.exec(`ALTER TABLE projects ADD COLUMN ${name} ${type}`);
    }
  }
  // فريد جزئياً: لا يمنع NULL (مشاريع قديمة بلا رقم) لكن يمنع تكرار رقم مشروع فعلي - يلبي
  // "منع تكرار المشاريع بنفس البيانات" + "رقم تعريف فريد" دون كسر المشاريع الموجودة مسبقاً.
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_code_unique ON projects(project_code) WHERE project_code IS NOT NULL AND project_code != ''`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_projects_archived ON projects(is_archived)`);
}

function createPmTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pm_project_status_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      old_status TEXT,
      new_status TEXT NOT NULL,
      note TEXT,
      actor TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_pm_status_log_project ON pm_project_status_log(project_id);

    CREATE TABLE IF NOT EXISTS pm_phases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sequence INTEGER NOT NULL DEFAULT 0,
      planned_start TEXT,
      planned_end TEXT,
      actual_start TEXT,
      actual_end TEXT,
      responsible TEXT,
      status TEXT NOT NULL DEFAULT 'not_started',
      progress_pct REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_pm_phases_project ON pm_phases(project_id);

    CREATE TABLE IF NOT EXISTS pm_team_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      cost_per_day REAL NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_pm_team_project ON pm_team_members(project_id);

    CREATE TABLE IF NOT EXISTS pm_attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_member_id INTEGER NOT NULL REFERENCES pm_team_members(id) ON DELETE CASCADE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'present',
      hours REAL NOT NULL DEFAULT 8,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(team_member_id, date)
    );
    CREATE INDEX IF NOT EXISTS idx_pm_attendance_member ON pm_attendance(team_member_id);
    CREATE INDEX IF NOT EXISTS idx_pm_attendance_project ON pm_attendance(project_id, date);

    CREATE TABLE IF NOT EXISTS pm_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      phase_id INTEGER REFERENCES pm_phases(id) ON DELETE SET NULL,
      parent_task_id INTEGER REFERENCES pm_tasks(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      assignee_id INTEGER REFERENCES pm_team_members(id) ON DELETE SET NULL,
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'not_started',
      planned_start TEXT,
      planned_end TEXT,
      actual_start TEXT,
      actual_end TEXT,
      duration_days REAL NOT NULL DEFAULT 1,
      progress_pct REAL NOT NULL DEFAULT 0,
      is_recurring INTEGER NOT NULL DEFAULT 0,
      recurrence_rule TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_pm_tasks_project ON pm_tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_pm_tasks_phase ON pm_tasks(phase_id);
    CREATE INDEX IF NOT EXISTS idx_pm_tasks_parent ON pm_tasks(parent_task_id);
    CREATE INDEX IF NOT EXISTS idx_pm_tasks_assignee ON pm_tasks(assignee_id);
    CREATE INDEX IF NOT EXISTS idx_pm_tasks_dates ON pm_tasks(planned_start, planned_end);
    CREATE INDEX IF NOT EXISTS idx_pm_tasks_status ON pm_tasks(status);

    CREATE TABLE IF NOT EXISTS pm_task_dependencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES pm_tasks(id) ON DELETE CASCADE,
      depends_on_task_id INTEGER NOT NULL REFERENCES pm_tasks(id) ON DELETE CASCADE,
      dep_type TEXT NOT NULL DEFAULT 'FS',
      lag_days REAL NOT NULL DEFAULT 0,
      UNIQUE(task_id, depends_on_task_id)
    );
    CREATE INDEX IF NOT EXISTS idx_pm_deps_task ON pm_task_dependencies(task_id);
    CREATE INDEX IF NOT EXISTS idx_pm_deps_dependson ON pm_task_dependencies(depends_on_task_id);

    CREATE TABLE IF NOT EXISTS pm_task_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES pm_tasks(id) ON DELETE CASCADE,
      author TEXT,
      comment TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_pm_comments_task ON pm_task_comments(task_id);

    CREATE TABLE IF NOT EXISTS pm_budget_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      item_type TEXT NOT NULL,
      category TEXT,
      description TEXT,
      amount REAL NOT NULL DEFAULT 0,
      date TEXT,
      reference_no TEXT,
      status TEXT NOT NULL DEFAULT 'recorded',
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_pm_budget_project ON pm_budget_items(project_id);
    CREATE INDEX IF NOT EXISTS idx_pm_budget_type ON pm_budget_items(item_type);

    CREATE TABLE IF NOT EXISTS pm_resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      resource_type TEXT NOT NULL,
      name TEXT NOT NULL,
      identifier TEXT,
      unit TEXT,
      unit_cost REAL NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_pm_resources_type ON pm_resources(resource_type);

    CREATE TABLE IF NOT EXISTS pm_resource_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      resource_id INTEGER NOT NULL REFERENCES pm_resources(id) ON DELETE CASCADE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      quantity REAL NOT NULL DEFAULT 1,
      start_date TEXT,
      end_date TEXT,
      cost REAL NOT NULL DEFAULT 0,
      operating_hours REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_pm_assign_resource ON pm_resource_assignments(resource_id);
    CREATE INDEX IF NOT EXISTS idx_pm_assign_project ON pm_resource_assignments(project_id);
    CREATE INDEX IF NOT EXISTS idx_pm_assign_dates ON pm_resource_assignments(start_date, end_date);

    CREATE TABLE IF NOT EXISTS pm_risks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      cause TEXT,
      category TEXT,
      probability INTEGER NOT NULL DEFAULT 3,
      impact INTEGER NOT NULL DEFAULT 3,
      owner TEXT,
      mitigation_plan TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      review_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_pm_risks_project ON pm_risks(project_id);
    CREATE INDEX IF NOT EXISTS idx_pm_risks_status ON pm_risks(status);

    CREATE TABLE IF NOT EXISTS pm_quality_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      record_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      result TEXT,
      related_task_id INTEGER REFERENCES pm_tasks(id) ON DELETE SET NULL,
      responsible TEXT,
      record_date TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      corrective_action TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_pm_quality_project ON pm_quality_records(project_id);

    CREATE TABLE IF NOT EXISTS pm_safety_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      record_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      severity TEXT NOT NULL DEFAULT 'low',
      responsible TEXT,
      record_date TEXT,
      corrective_action TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_pm_safety_project ON pm_safety_records(project_id);

    CREATE TABLE IF NOT EXISTS pm_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      category TEXT,
      name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL DEFAULT 0,
      mime_type TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'draft',
      uploaded_by TEXT,
      approved_by TEXT,
      approved_at TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_pm_documents_project ON pm_documents(project_id);
    CREATE INDEX IF NOT EXISTS idx_pm_documents_category ON pm_documents(category);

    CREATE TABLE IF NOT EXISTS pm_document_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL REFERENCES pm_documents(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL DEFAULT 0,
      uploaded_by TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_pm_docversions_doc ON pm_document_versions(document_id);

    CREATE TABLE IF NOT EXISTS pm_meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      meeting_date TEXT,
      location TEXT,
      attendees_json TEXT NOT NULL DEFAULT '[]',
      agenda TEXT,
      minutes TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_pm_meetings_project ON pm_meetings(project_id);

    CREATE TABLE IF NOT EXISTS pm_meeting_decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id INTEGER NOT NULL REFERENCES pm_meetings(id) ON DELETE CASCADE,
      decision_text TEXT NOT NULL,
      responsible TEXT,
      due_date TEXT,
      generated_task_id INTEGER REFERENCES pm_tasks(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_pm_decisions_meeting ON pm_meeting_decisions(meeting_id);

    CREATE TABLE IF NOT EXISTS pm_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      title TEXT NOT NULL,
      message TEXT,
      related_entity_type TEXT,
      related_entity_id INTEGER,
      dedup_key TEXT UNIQUE,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_pm_notif_project ON pm_notifications(project_id);
    CREATE INDEX IF NOT EXISTS idx_pm_notif_read ON pm_notifications(is_read);

    CREATE TABLE IF NOT EXISTS pm_report_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      report_type TEXT NOT NULL,
      format TEXT NOT NULL DEFAULT 'view',
      generated_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_pm_report_log_project ON pm_report_log(project_id);

    CREATE TABLE IF NOT EXISTS pm_audit_log (
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
    CREATE INDEX IF NOT EXISTS idx_pm_audit_project ON pm_audit_log(project_id);
    CREATE INDEX IF NOT EXISTS idx_pm_audit_entity ON pm_audit_log(entity_type, entity_id);
  `);
}

function ensurePmSchema() {
  if (globalForPm.__pmSchemaReady) return;
  const db = getDb();
  migrateProjectsColumns(db);
  createPmTables(db);
  globalForPm.__pmSchemaReady = true;
}

/** يُعيد اتصال قاعدة البيانات الموحّد، بعد التأكد من جاهزية مخطط القسم الرابع (idempotent). */
export function pdb() {
  ensurePmSchema();
  return getDb();
}

/** ثوابت الحالات المستخدمة عبر وحدات القسم الرابع - مصدر واحد لتفادي تكرارها. */
export const PROJECT_STATUSES = ['planning', 'in_progress', 'stopped', 'completed', 'cancelled', 'archived'];
export const PROJECT_PRIORITIES = ['low', 'medium', 'high', 'critical'];
export const TASK_STATUSES = ['not_started', 'in_progress', 'delayed', 'completed', 'on_hold'];
export const PHASE_STATUSES = ['not_started', 'in_progress', 'completed', 'on_hold'];
