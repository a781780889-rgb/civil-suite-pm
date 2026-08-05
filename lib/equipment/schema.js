// lib/equipment/schema.js
// =============================================================================
// القسم السابع: نظام إدارة المعدات (Equipment & Assets Management System) — طبقة المخطط.
//
// يتبع بالضبط نفس نمط lib/pm/schema.js (الموسّع بدوره من lib/schedule/schema.js
// وlib/business/schema.js): يعيد استخدام اتصال SQLite الموحّد (lib/db.js:getDb) بدل فتح
// اتصال منفصل - هذا هو المقصود حرفياً بـ "قاعدة بيانات مركزية واحدة" في مواصفة القسم.
// لا يُعدَّل lib/db.js إطلاقاً (صفر أثر على الأقسام 1-6 العاملة فعلياً)؛ كل جداول هذا
// القسم ببادئة `equipment_` (بنفس نمط `pm_`/`biz_`)، معزولة تماماً عن غيرها، وتُنشأ فقط
// عند أول استدعاء فعلي لأي مسار API في هذا القسم (lazy، idempotent عبر PRAGMA/IF NOT EXISTS).
//
// الربط بالمشروع (البند 22: "التكامل مع باقي المنصة") يتم عبر `project_id INTEGER
// REFERENCES projects(id)` مباشرة - نفس أسلوب pm_resource_assignments بالضبط - دون أي
// تعديل على جدول pm_resources (نوع المورد العام "equipment" هناك يبقى كما هو لأغراض جدولة
// Gantt الخفيفة؛ هذا القسم هو السجل التفصيلي الكامل لدورة حياة كل معدة).
// =============================================================================

import { getDb } from '../db.js';

const globalForEquipment = globalThis;

function createEquipmentTables(db) {
  db.exec(`
    -- ============== تصنيف المعدات (البند 3) ==============
    CREATE TABLE IF NOT EXISTS equipment_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      group_key TEXT NOT NULL,
      group_label_ar TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      is_custom INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_equip_categories_group ON equipment_categories(group_key);

    -- ============== سجل المعدات الرئيسي (البند 2) ==============
    CREATE TABLE IF NOT EXISTS equipment_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      equipment_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category_key TEXT REFERENCES equipment_categories(key),
      manufacturer TEXT,
      model TEXT,
      manufacture_year INTEGER,
      serial_number TEXT,
      chassis_number TEXT,
      engine_number TEXT,
      plate_number TEXT,
      color TEXT,
      weight_kg REAL,
      capacity_value REAL,
      capacity_unit TEXT,
      operating_power TEXT,
      tank_capacity_l REAL,
      fuel_type TEXT,
      rated_consumption_l_per_hour REAL,
      ownership_type TEXT NOT NULL DEFAULT 'owned',
      current_location TEXT,
      current_project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      responsible_person TEXT,
      status TEXT NOT NULL DEFAULT 'available',
      purchase_date TEXT,
      purchase_price REAL NOT NULL DEFAULT 0,
      useful_life_years REAL,
      salvage_value REAL NOT NULL DEFAULT 0,
      warranty_expiry TEXT,
      insurance_provider TEXT,
      insurance_policy_no TEXT,
      insurance_expiry TEXT,
      current_hour_meter REAL NOT NULL DEFAULT 0,
      photo_base64 TEXT,
      notes TEXT,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_equip_assets_status ON equipment_assets(status);
    CREATE INDEX IF NOT EXISTS idx_equip_assets_category ON equipment_assets(category_key);
    CREATE INDEX IF NOT EXISTS idx_equip_assets_project ON equipment_assets(current_project_id);
    CREATE INDEX IF NOT EXISTS idx_equip_assets_archived ON equipment_assets(is_archived);

    -- ============== مستندات المعدة ==============
    CREATE TABLE IF NOT EXISTS equipment_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      equipment_id INTEGER NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
      doc_type TEXT NOT NULL DEFAULT 'other',
      file_path TEXT NOT NULL,
      original_name TEXT,
      mime_type TEXT,
      size_bytes INTEGER,
      uploaded_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_equip_docs_equipment ON equipment_documents(equipment_id);

    -- ============== سجل الحالة والموقع (البند 4) ==============
    CREATE TABLE IF NOT EXISTS equipment_status_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
      old_status TEXT,
      new_status TEXT NOT NULL,
      old_location TEXT,
      new_location TEXT,
      old_project_id INTEGER,
      new_project_id INTEGER,
      note TEXT,
      actor TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_equip_status_log_equipment ON equipment_status_log(equipment_id);

    -- ============== تخصيص المعدات على المشاريع (البند 5) ==============
    CREATE TABLE IF NOT EXISTS equipment_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      equipment_id INTEGER NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      operator_id INTEGER REFERENCES equipment_operators(id) ON DELETE SET NULL,
      activity TEXT,
      location TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      actor TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_equip_assign_equipment ON equipment_assignments(equipment_id);
    CREATE INDEX IF NOT EXISTS idx_equip_assign_project ON equipment_assignments(project_id);
    CREATE INDEX IF NOT EXISTS idx_equip_assign_status ON equipment_assignments(status);

    -- ============== الحجوزات (البند 6) ==============
    CREATE TABLE IF NOT EXISTS equipment_reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      equipment_id INTEGER NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      activity TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      planned_hours REAL,
      responsible TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      actor TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_equip_resv_equipment ON equipment_reservations(equipment_id);
    CREATE INDEX IF NOT EXISTS idx_equip_resv_project ON equipment_reservations(project_id);
    CREATE INDEX IF NOT EXISTS idx_equip_resv_status ON equipment_reservations(status);

    -- ============== سجل التشغيل (البند 7) ==============
    CREATE TABLE IF NOT EXISTS equipment_operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      equipment_id INTEGER NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      operator_id INTEGER REFERENCES equipment_operators(id) ON DELETE SET NULL,
      log_date TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      hours REAL NOT NULL DEFAULT 0,
      activity TEXT,
      productivity_qty REAL,
      productivity_unit TEXT,
      fuel_used_l REAL,
      start_hour_meter REAL,
      end_hour_meter REAL,
      notes TEXT,
      actor TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_equip_oplog_equipment ON equipment_operation_logs(equipment_id);
    CREATE INDEX IF NOT EXISTS idx_equip_oplog_project ON equipment_operation_logs(project_id);
    CREATE INDEX IF NOT EXISTS idx_equip_oplog_date ON equipment_operation_logs(log_date);

    -- ============== عداد ساعات التشغيل (البند 8) ==============
    CREATE TABLE IF NOT EXISTS equipment_hour_meter_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
      reading_value REAL NOT NULL,
      previous_value REAL NOT NULL DEFAULT 0,
      delta_hours REAL NOT NULL DEFAULT 0,
      reading_date TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      recorded_by TEXT,
      override_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_equip_hourmeter_equipment ON equipment_hour_meter_readings(equipment_id);

    -- ============== الوقود (البند 9) ==============
    CREATE TABLE IF NOT EXISTS equipment_fuel_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      equipment_id INTEGER NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      operator_id INTEGER REFERENCES equipment_operators(id) ON DELETE SET NULL,
      fill_date TEXT NOT NULL,
      quantity_l REAL NOT NULL,
      fuel_type TEXT,
      price_per_liter REAL NOT NULL DEFAULT 0,
      total_cost REAL NOT NULL DEFAULT 0,
      hour_meter_reading REAL,
      supplier TEXT,
      operation_no TEXT,
      notes TEXT,
      actor TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_equip_fuel_equipment ON equipment_fuel_logs(equipment_id);
    CREATE INDEX IF NOT EXISTS idx_equip_fuel_project ON equipment_fuel_logs(project_id);
    CREATE INDEX IF NOT EXISTS idx_equip_fuel_date ON equipment_fuel_logs(fill_date);

    -- ============== خطط الصيانة الوقائية (البند 10-11) ==============
    CREATE TABLE IF NOT EXISTS equipment_maintenance_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      equipment_id INTEGER REFERENCES equipment_assets(id) ON DELETE CASCADE,
      category_key TEXT REFERENCES equipment_categories(key),
      title TEXT NOT NULL,
      maintenance_items TEXT NOT NULL DEFAULT '[]',
      interval_type TEXT NOT NULL DEFAULT 'hours',
      interval_hours REAL,
      interval_days INTEGER,
      last_done_hour_meter REAL,
      last_done_date TEXT,
      next_due_hour_meter REAL,
      next_due_date TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      actor TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_equip_msched_equipment ON equipment_maintenance_schedules(equipment_id);
    CREATE INDEX IF NOT EXISTS idx_equip_msched_active ON equipment_maintenance_schedules(is_active);

    -- ============== سجلات الصيانة الفعلية (وقائية + تصحيحية) ==============
    CREATE TABLE IF NOT EXISTS equipment_maintenance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      equipment_id INTEGER NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
      schedule_id INTEGER REFERENCES equipment_maintenance_schedules(id) ON DELETE SET NULL,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      maintenance_type TEXT NOT NULL DEFAULT 'preventive',
      title TEXT NOT NULL,
      description TEXT,
      maintenance_date TEXT NOT NULL,
      hour_meter_at_service REAL,
      technician TEXT,
      labor_cost REAL NOT NULL DEFAULT 0,
      parts_cost REAL NOT NULL DEFAULT 0,
      total_cost REAL NOT NULL DEFAULT 0,
      downtime_hours REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'completed',
      actor TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_equip_mrec_equipment ON equipment_maintenance_records(equipment_id);
    CREATE INDEX IF NOT EXISTS idx_equip_mrec_date ON equipment_maintenance_records(maintenance_date);
    CREATE INDEX IF NOT EXISTS idx_equip_mrec_type ON equipment_maintenance_records(maintenance_type);

    -- ============== الأعطال (البند 12) ==============
    CREATE TABLE IF NOT EXISTS equipment_breakdowns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      report_no TEXT NOT NULL UNIQUE,
      equipment_id INTEGER NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      breakdown_date TEXT NOT NULL,
      stop_time TEXT,
      description TEXT NOT NULL,
      cause TEXT,
      severity TEXT NOT NULL DEFAULT 'medium',
      responsible TEXT,
      corrective_action TEXT,
      parts_cost REAL NOT NULL DEFAULT 0,
      labor_cost REAL NOT NULL DEFAULT 0,
      total_cost REAL NOT NULL DEFAULT 0,
      resume_time TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      actor TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_equip_break_equipment ON equipment_breakdowns(equipment_id);
    CREATE INDEX IF NOT EXISTS idx_equip_break_status ON equipment_breakdowns(status);
    CREATE INDEX IF NOT EXISTS idx_equip_break_date ON equipment_breakdowns(breakdown_date);

    -- ============== قطع الغيار (البند 13) ==============
    CREATE TABLE IF NOT EXISTS equipment_spare_parts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      part_name TEXT NOT NULL,
      part_number TEXT,
      manufacturer TEXT,
      supplier TEXT,
      compatible_categories TEXT NOT NULL DEFAULT '[]',
      unit_price REAL NOT NULL DEFAULT 0,
      quantity_on_hand REAL NOT NULL DEFAULT 0,
      min_stock REAL NOT NULL DEFAULT 0,
      storage_location TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_equip_parts_number ON equipment_spare_parts(part_number);

    CREATE TABLE IF NOT EXISTS equipment_spare_part_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_id INTEGER NOT NULL REFERENCES equipment_spare_parts(id) ON DELETE RESTRICT,
      maintenance_record_id INTEGER REFERENCES equipment_maintenance_records(id) ON DELETE CASCADE,
      breakdown_id INTEGER REFERENCES equipment_breakdowns(id) ON DELETE CASCADE,
      quantity REAL NOT NULL,
      unit_price_at_use REAL NOT NULL DEFAULT 0,
      total_cost REAL NOT NULL DEFAULT 0,
      used_date TEXT NOT NULL,
      actor TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_equip_partuse_part ON equipment_spare_part_usage(part_id);
    CREATE INDEX IF NOT EXISTS idx_equip_partuse_maint ON equipment_spare_part_usage(maintenance_record_id);
    CREATE INDEX IF NOT EXISTS idx_equip_partuse_break ON equipment_spare_part_usage(breakdown_id);

    -- ============== المشغلون (البند 14) ==============
    CREATE TABLE IF NOT EXISTS equipment_operators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      employee_no TEXT,
      national_id TEXT,
      specialization TEXT,
      license_no TEXT,
      license_type TEXT,
      license_expiry TEXT,
      training_notes TEXT,
      allowed_categories TEXT NOT NULL DEFAULT '[]',
      performance_notes TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_equip_operators_active ON equipment_operators(is_active);

    CREATE TABLE IF NOT EXISTS equipment_operator_authorizations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operator_id INTEGER NOT NULL REFERENCES equipment_operators(id) ON DELETE CASCADE,
      equipment_id INTEGER NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
      authorized_date TEXT NOT NULL DEFAULT (datetime('now')),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(operator_id, equipment_id)
    );
    CREATE INDEX IF NOT EXISTS idx_equip_opauth_operator ON equipment_operator_authorizations(operator_id);
    CREATE INDEX IF NOT EXISTS idx_equip_opauth_equipment ON equipment_operator_authorizations(equipment_id);

    -- ============== نقل المعدات (البند 18) ==============
    CREATE TABLE IF NOT EXISTS equipment_transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      equipment_id INTEGER NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
      from_location TEXT,
      to_location TEXT NOT NULL,
      from_project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      to_project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      transfer_date TEXT NOT NULL,
      responsible TEXT,
      cost REAL NOT NULL DEFAULT 0,
      transport_method TEXT,
      status TEXT NOT NULL DEFAULT 'planned',
      notes TEXT,
      actor TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_equip_transfer_equipment ON equipment_transfers(equipment_id);
    CREATE INDEX IF NOT EXISTS idx_equip_transfer_status ON equipment_transfers(status);

    -- ============== المعدات المؤجرة (البند 17) ==============
    CREATE TABLE IF NOT EXISTS equipment_rentals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      equipment_id INTEGER NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
      rental_company TEXT NOT NULL,
      contract_no TEXT,
      rental_start TEXT NOT NULL,
      rental_end TEXT,
      rental_cost_total REAL NOT NULL DEFAULT 0,
      hourly_cost REAL NOT NULL DEFAULT 0,
      terms TEXT,
      insurance_info TEXT,
      contract_status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      actor TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_equip_rental_equipment ON equipment_rentals(equipment_id);
    CREATE INDEX IF NOT EXISTS idx_equip_rental_status ON equipment_rentals(contract_status);

    -- ============== فحوصات السلامة (البند 15 - مرتبط بوحدة صلاحية "safety" الموجودة) ==============
    CREATE TABLE IF NOT EXISTS equipment_inspections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      equipment_id INTEGER NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
      inspection_type TEXT NOT NULL DEFAULT 'pre_operation',
      checklist_json TEXT NOT NULL DEFAULT '[]',
      defects_found TEXT,
      inspector TEXT,
      inspection_date TEXT NOT NULL,
      result TEXT NOT NULL DEFAULT 'pass',
      notes TEXT,
      actor TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_equip_inspect_equipment ON equipment_inspections(equipment_id);

    -- ============== التنبيهات ==============
    CREATE TABLE IF NOT EXISTS equipment_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER REFERENCES equipment_assets(id) ON DELETE CASCADE,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
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
    CREATE INDEX IF NOT EXISTS idx_equip_notif_equipment ON equipment_notifications(equipment_id);
    CREATE INDEX IF NOT EXISTS idx_equip_notif_read ON equipment_notifications(is_read);

    -- ============== سجل التدقيق (البند 25) ==============
    CREATE TABLE IF NOT EXISTS equipment_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      action TEXT NOT NULL,
      before_json TEXT,
      after_json TEXT,
      actor TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_equip_audit_equipment ON equipment_audit_log(equipment_id);
    CREATE INDEX IF NOT EXISTS idx_equip_audit_entity ON equipment_audit_log(entity_type, entity_id);

    -- ============== سجل توليد التقارير ==============
    CREATE TABLE IF NOT EXISTS equipment_report_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER,
      report_type TEXT NOT NULL,
      format TEXT NOT NULL DEFAULT 'view',
      generated_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

const DEFAULT_CATEGORIES = [
  // معدات الحفر
  ['excavator', 'drilling', 'معدات الحفر', 'حفارة'],
  ['backhoe_loader', 'drilling', 'معدات الحفر', 'شيول'],
  ['bulldozer', 'drilling', 'معدات الحفر', 'جرافة/بلدوزر'],
  ['grader', 'drilling', 'معدات الحفر', 'قريدر'],
  ['wheel_loader', 'drilling', 'معدات الحفر', 'لودر'],
  // معدات الرفع
  ['tower_crane', 'lifting', 'معدات الرفع', 'رافعة برجية'],
  ['mobile_crane', 'lifting', 'معدات الرفع', 'رافعة متحركة'],
  ['forklift', 'lifting', 'معدات الرفع', 'فوركلفت'],
  ['temporary_hoist', 'lifting', 'معدات الرفع', 'مصعد مؤقت / منصة رفع'],
  // معدات الخرسانة
  ['concrete_pump', 'concrete', 'معدات الخرسانة', 'مضخة خرسانة'],
  ['concrete_mixer', 'concrete', 'معدات الخرسانة', 'خلاطة'],
  ['transit_mixer', 'concrete', 'معدات الخرسانة', 'سيارة نقل خرسانة'],
  ['concrete_vibrator', 'concrete', 'معدات الخرسانة', 'هزاز خرسانة'],
  // معدات الطرق
  ['roller_compactor', 'roads', 'معدات الطرق', 'مدحلة'],
  ['asphalt_paver', 'roads', 'معدات الطرق', 'فرادة أسفلت'],
  ['asphalt_cutter', 'roads', 'معدات الطرق', 'ماكينة قص أسفلت'],
  ['line_marking', 'roads', 'معدات الطرق', 'معدات تخطيط'],
  // معدات النقل
  ['dump_truck', 'transport', 'معدات النقل', 'قلاب'],
  ['flatbed_truck', 'transport', 'معدات النقل', 'شاحنة نقل'],
  ['trailer', 'transport', 'معدات النقل', 'مقطورة'],
  // معدات الكهرباء والطاقة
  ['generator', 'power', 'معدات الكهرباء والطاقة', 'مولد كهرباء'],
  ['air_compressor', 'power', 'معدات الكهرباء والطاقة', 'ضاغط هواء'],
  ['transformer', 'power', 'معدات الكهرباء والطاقة', 'محول كهرباء'],
  ['distribution_panel', 'power', 'معدات الكهرباء والطاقة', 'لوحة توزيع مؤقتة'],
  // معدات الورش
  ['welding_machine', 'workshop', 'معدات الورش', 'ماكينة لحام'],
  ['cutting_machine', 'workshop', 'معدات الورش', 'جهاز قص'],
  ['bending_machine', 'workshop', 'معدات الورش', 'جهاز ثني'],
  ['carpentry_equipment', 'workshop', 'معدات الورش', 'معدات نجارة'],
  // معدات السلامة
  ['scaffolding', 'safety', 'معدات السلامة', 'سقالات'],
  ['work_platform', 'safety', 'معدات السلامة', 'منصات عمل'],
  ['rescue_equipment', 'safety', 'معدات السلامة', 'معدات إنقاذ'],
];

function seedDefaultCategories(db) {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO equipment_categories (key, group_key, group_label_ar, name_ar, is_custom) VALUES (?, ?, ?, ?, 0)`
  );
  const run = db.transaction((rows) => { for (const r of rows) insert.run(r); });
  run(DEFAULT_CATEGORIES);
}

function ensureEquipmentSchema() {
  if (globalForEquipment.__equipmentSchemaReady) return;
  const db = getDb();
  createEquipmentTables(db);
  seedDefaultCategories(db);
  globalForEquipment.__equipmentSchemaReady = true;
}

/** يُعيد اتصال قاعدة البيانات الموحّد، بعد التأكد من جاهزية مخطط القسم السابع (idempotent). */
export function edb() {
  ensureEquipmentSchema();
  return getDb();
}

// ثوابت الحالات المستخدمة عبر وحدات القسم السابع - مصدر واحد لتفادي تكرارها (نفس أسلوب pm/schema.js).
export const EQUIPMENT_STATUSES = ['available', 'in_use', 'maintenance', 'stopped', 'reserved', 'out_of_service', 'sold', 'archived'];
export const OWNERSHIP_TYPES = ['owned', 'rented'];
export const ASSIGNMENT_STATUSES = ['active', 'completed', 'cancelled'];
export const RESERVATION_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];
export const MAINTENANCE_TYPES = ['preventive', 'corrective'];
export const MAINTENANCE_RECORD_STATUSES = ['scheduled', 'in_progress', 'completed'];
export const BREAKDOWN_SEVERITIES = ['low', 'medium', 'high', 'critical'];
export const BREAKDOWN_STATUSES = ['open', 'in_repair', 'resolved'];
export const TRANSFER_STATUSES = ['planned', 'in_transit', 'completed', 'cancelled'];
export const RENTAL_STATUSES = ['active', 'expired', 'terminated'];
export const INSPECTION_TYPES = ['pre_operation', 'periodic'];
export const INSPECTION_RESULTS = ['pass', 'fail', 'pass_with_notes'];
export const DOCUMENT_TYPES = ['photo', 'manual', 'warranty', 'insurance', 'other'];
