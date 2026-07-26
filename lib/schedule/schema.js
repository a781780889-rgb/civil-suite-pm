// lib/schedule/schema.js
// =============================================================================
// القسم الخامس: نظام الجدول الزمني (Project Scheduling System) — طبقة المخطط.
//
// يعيد استخدام نفس اتصال SQLite الموحّد (lib/db.js:getDb) — "قاعدة بيانات مركزية واحدة"
// حرفياً، بنفس مبدأ lib/pm/schema.js تماماً. لا يُعدَّل lib/db.js ولا lib/pm/schema.js
// إطلاقاً (لتفادي أي تأثير على الأقسام 1-4 العاملة فعلياً). بدلاً من ذلك:
//   - جداول جديدة كلها ببادئة `sch_` معزولة تماماً عن غيرها.
//   - يرتبط كل جدول زمني (sch_schedules) بمشروع واحد فقط عبر project_id → projects(id)
//     الموجود أصلاً (القاعدة الثانية الإلزامية)، محققاً التكامل دون أي تكرار للبيانات.
//   - تعيين الموارد على الأنشطة (sch_activity_resources) يرجع لجدول pm_resources
//     الموجود أصلاً (مستودع موارد واحد موحّد للمنصة) بدل تكرار جدول موارد جديد.
//   - سجل التدقيق/التنبيهات/سجل التقارير: تُستخدم جداول pm_audit_log / pm_notifications /
//     pm_report_log العامة الموجودة أصلاً (entity_type محدَّد بقيم 'schedule' / 'sch_activity'
//     / 'sch_relationship' / 'sch_baseline' / 'sch_activity_resource') بدل تكرارها - هذا هو
//     المقصود عملياً بـ "قاعدة بيانات مركزية" و"تكامل كامل" في المستند الإلزامي.
//
// لماذا جداول جديدة (sch_*) بدل توسيع pm_tasks / pm_task_dependencies الموجودة في القسم
// الرابع؟ لأن القسم الرابع يحتوي بالفعل جدولاً زمنياً مبسّطاً (مهام + تبعيات + مسار حرج
// بمستوى الأيام الخام) كـ"تبويب واحد" ضمن إدارة المشاريع - يعمل ومُختبر ولا يُمس هنا إطلاقاً.
// أما هذا القسم فمطلوب أن يكون نظاماً مستقلاً بمستوى Primavera P6: WBS هرمي مرقّم تلقائياً،
// جدولة واعية بالتقويم (أيام عمل/عطل فعلية لا أيام تقويمية خام)، Baselines كاملة، Free Float
// إضافة لـ Total Float، وتعيين موارد على مستوى النشاط نفسه لا المشروع فقط - وله لوحة تحكم
// خاصة تُجمّع عبر كل المشاريع (نظير مستقل لقسم إدارة المشاريع، وليس تبويباً داخله).
// =============================================================================

import { getDb } from '../db.js';

const globalForSchedule = globalThis;

function createScheduleTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sch_calendars (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      working_days TEXT NOT NULL DEFAULT '[0,1,2,3,4]',
      hours_per_day REAL NOT NULL DEFAULT 8,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sch_calendars_project ON sch_calendars(project_id);

    CREATE TABLE IF NOT EXISTS sch_calendar_exceptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      calendar_id INTEGER NOT NULL REFERENCES sch_calendars(id) ON DELETE CASCADE,
      exception_date TEXT NOT NULL,
      is_working INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      UNIQUE(calendar_id, exception_date)
    );
    CREATE INDEX IF NOT EXISTS idx_sch_cal_exc_cal ON sch_calendar_exceptions(calendar_id);

    CREATE TABLE IF NOT EXISTS sch_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      version_label TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      is_primary INTEGER NOT NULL DEFAULT 1,
      calendar_id INTEGER REFERENCES sch_calendars(id) ON DELETE SET NULL,
      data_date TEXT,
      is_locked INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sch_schedules_project ON sch_schedules(project_id);

    CREATE TABLE IF NOT EXISTS sch_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      schedule_id INTEGER NOT NULL REFERENCES sch_schedules(id) ON DELETE CASCADE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      parent_id INTEGER REFERENCES sch_activities(id) ON DELETE CASCADE,
      wbs_code TEXT,
      sequence INTEGER NOT NULL DEFAULT 0,
      activity_code TEXT,
      name TEXT NOT NULL,
      description TEXT,
      activity_type TEXT NOT NULL DEFAULT 'task',
      status TEXT NOT NULL DEFAULT 'not_started',
      priority TEXT NOT NULL DEFAULT 'medium',
      responsible TEXT,
      calendar_id INTEGER REFERENCES sch_calendars(id) ON DELETE SET NULL,
      duration_days REAL NOT NULL DEFAULT 1,
      planned_start TEXT,
      planned_end TEXT,
      actual_start TEXT,
      actual_end TEXT,
      progress_pct REAL NOT NULL DEFAULT 0,
      location TEXT,
      notes TEXT,
      early_start TEXT,
      early_finish TEXT,
      late_start TEXT,
      late_finish TEXT,
      total_float_days REAL,
      free_float_days REAL,
      is_critical INTEGER NOT NULL DEFAULT 0,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sch_act_schedule ON sch_activities(schedule_id);
    CREATE INDEX IF NOT EXISTS idx_sch_act_parent ON sch_activities(parent_id);
    CREATE INDEX IF NOT EXISTS idx_sch_act_project ON sch_activities(project_id);
    CREATE INDEX IF NOT EXISTS idx_sch_act_dates ON sch_activities(planned_start, planned_end);
    CREATE INDEX IF NOT EXISTS idx_sch_act_status ON sch_activities(status);

    CREATE TABLE IF NOT EXISTS sch_relationships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER NOT NULL REFERENCES sch_schedules(id) ON DELETE CASCADE,
      predecessor_id INTEGER NOT NULL REFERENCES sch_activities(id) ON DELETE CASCADE,
      successor_id INTEGER NOT NULL REFERENCES sch_activities(id) ON DELETE CASCADE,
      rel_type TEXT NOT NULL DEFAULT 'FS',
      lag_days REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(predecessor_id, successor_id, rel_type)
    );
    CREATE INDEX IF NOT EXISTS idx_sch_rel_schedule ON sch_relationships(schedule_id);
    CREATE INDEX IF NOT EXISTS idx_sch_rel_pred ON sch_relationships(predecessor_id);
    CREATE INDEX IF NOT EXISTS idx_sch_rel_succ ON sch_relationships(successor_id);

    CREATE TABLE IF NOT EXISTS sch_baselines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      schedule_id INTEGER NOT NULL REFERENCES sch_schedules(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      snapshot_date TEXT NOT NULL DEFAULT (datetime('now')),
      notes TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sch_baseline_schedule ON sch_baselines(schedule_id);

    CREATE TABLE IF NOT EXISTS sch_baseline_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      baseline_id INTEGER NOT NULL REFERENCES sch_baselines(id) ON DELETE CASCADE,
      activity_id INTEGER NOT NULL,
      wbs_code TEXT,
      name TEXT,
      planned_start TEXT,
      planned_end TEXT,
      duration_days REAL,
      progress_pct REAL
    );
    CREATE INDEX IF NOT EXISTS idx_sch_baseline_act_baseline ON sch_baseline_activities(baseline_id);
    CREATE INDEX IF NOT EXISTS idx_sch_baseline_act_activity ON sch_baseline_activities(activity_id);

    CREATE TABLE IF NOT EXISTS sch_activity_resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      schedule_id INTEGER NOT NULL REFERENCES sch_schedules(id) ON DELETE CASCADE,
      activity_id INTEGER NOT NULL REFERENCES sch_activities(id) ON DELETE CASCADE,
      resource_id INTEGER NOT NULL REFERENCES pm_resources(id) ON DELETE CASCADE,
      quantity REAL NOT NULL DEFAULT 1,
      planned_hours REAL NOT NULL DEFAULT 0,
      planned_cost REAL NOT NULL DEFAULT 0,
      start_date TEXT,
      end_date TEXT,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sch_ares_activity ON sch_activity_resources(activity_id);
    CREATE INDEX IF NOT EXISTS idx_sch_ares_resource ON sch_activity_resources(resource_id);
    CREATE INDEX IF NOT EXISTS idx_sch_ares_dates ON sch_activity_resources(start_date, end_date);

    CREATE TABLE IF NOT EXISTS sch_progress_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id INTEGER NOT NULL REFERENCES sch_activities(id) ON DELETE CASCADE,
      schedule_id INTEGER NOT NULL REFERENCES sch_schedules(id) ON DELETE CASCADE,
      log_date TEXT NOT NULL DEFAULT (date('now')),
      progress_pct REAL NOT NULL,
      actual_start TEXT,
      actual_end TEXT,
      delay_reason TEXT,
      note TEXT,
      actor TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sch_progress_activity ON sch_progress_log(activity_id);
    CREATE INDEX IF NOT EXISTS idx_sch_progress_schedule ON sch_progress_log(schedule_id);
  `);
}

function ensureScheduleSchema() {
  if (globalForSchedule.__scheduleSchemaReady) return;
  const db = getDb();
  createScheduleTables(db);
  globalForSchedule.__scheduleSchemaReady = true;
}

/** يُعيد اتصال قاعدة البيانات الموحّد، بعد التأكد من جاهزية مخطط القسم الخامس (idempotent). */
export function sdb() {
  ensureScheduleSchema();
  return getDb();
}

// ثوابت مستخدمة عبر وحدات القسم الخامس - مصدر واحد لتفادي تكرارها (نفس نمط lib/pm/schema.js).
export const SCHEDULE_STATUSES = ['draft', 'active', 'archived'];
export const ACTIVITY_TYPES = ['task', 'milestone', 'summary', 'level_of_effort'];
export const ACTIVITY_STATUSES = ['not_started', 'in_progress', 'delayed', 'completed', 'on_hold'];
export const ACTIVITY_PRIORITIES = ['low', 'medium', 'high', 'critical'];
export const REL_TYPES = ['FS', 'SS', 'FF', 'SF'];
export const DEFAULT_WORKING_DAYS = [0, 1, 2, 3, 4]; // الأحد-الخميس (عطلة الجمعة والسبت)
