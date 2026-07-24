// lib/db.js
// طبقة قاعدة البيانات الموحدة (SQLite) - تُستخدم من جميع حاسبات القسم الأول
// اتصال واحد (singleton) يُعاد استخدامه عبر جميع الـ API routes لتفادي فتح اتصالات متعددة
// أثناء إعادة التحميل الساخن (HMR) في وضع التطوير.

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { formatReportNumber as formatReportNumberPure } from './reportNumber.js';
import { CATEGORIES as BOQ_CATEGORIES } from './boq/categoryRegistry.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'civil-suite.sqlite3');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function createConnection() {
  ensureDataDir();
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

// نحتفظ بالاتصال على الكائن العام global في وضع التطوير لتفادي تعدد الاتصالات
// بسبب Hot Module Reloading الخاص بـ Next.js
const globalForDb = globalThis;

export function getDb() {
  if (!globalForDb.__civilSuiteDb) {
    globalForDb.__civilSuiteDb = createConnection();
    initSchema(globalForDb.__civilSuiteDb);
  }
  return globalForDb.__civilSuiteDb;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      owner_name TEXT,
      contractor_name TEXT,
      consultant_name TEXT,
      engineer_name TEXT,
      location TEXT,
      logo_base64 TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS calculations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      calc_type TEXT NOT NULL,
      title TEXT,
      engineer_name TEXT,
      signature_base64 TEXT,
      inputs_json TEXT NOT NULL,
      results_json TEXT NOT NULL,
      warnings_json TEXT,
      status TEXT NOT NULL DEFAULT 'ok',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_calculations_type ON calculations(calc_type);
    CREATE INDEX IF NOT EXISTS idx_calculations_project ON calculations(project_id);
    CREATE INDEX IF NOT EXISTS idx_calculations_created ON calculations(created_at);

    CREATE TABLE IF NOT EXISTS steel_price_lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      steel_price_per_ton REAL NOT NULL DEFAULT 0,
      cutting_price_per_ton REAL NOT NULL DEFAULT 0,
      bending_price_per_ton REAL NOT NULL DEFAULT 0,
      installation_price_per_ton REAL NOT NULL DEFAULT 0,
      transport_price_per_ton REAL NOT NULL DEFAULT 0,
      tax_pct REAL NOT NULL DEFAULT 0,
      discount_pct REAL NOT NULL DEFAULT 0,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ============== القسم الثالث: نظام حصر الكميات (Quantity Takeoff) ==============

    CREATE TABLE IF NOT EXISTS boq_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      trade TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      calc_method TEXT NOT NULL,
      geometry_method TEXT,
      unit TEXT NOT NULL,
      default_waste_pct REAL NOT NULL DEFAULT 5,
      fields_json TEXT NOT NULL DEFAULT '[]',
      is_custom INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS boq_elements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      category_key TEXT NOT NULL REFERENCES boq_categories(key),
      linked_calculation_id INTEGER REFERENCES calculations(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      location_note TEXT,
      dimensions_json TEXT NOT NULL DEFAULT '{}',
      quantity REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL,
      waste_pct REAL NOT NULL DEFAULT 0,
      quantity_with_waste REAL NOT NULL DEFAULT 0,
      unit_material_price REAL NOT NULL DEFAULT 0,
      unit_labor_price REAL NOT NULL DEFAULT 0,
      unit_equipment_price REAL NOT NULL DEFAULT 0,
      unit_transport_price REAL NOT NULL DEFAULT 0,
      tax_pct REAL NOT NULL DEFAULT 0,
      discount_pct REAL NOT NULL DEFAULT 0,
      total_cost REAL NOT NULL DEFAULT 0,
      materials_json TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      source_ref TEXT,
      ai_confidence REAL,
      status TEXT NOT NULL DEFAULT 'confirmed',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_boq_elements_project ON boq_elements(project_id);
    CREATE INDEX IF NOT EXISTS idx_boq_elements_category ON boq_elements(category_key);
    CREATE INDEX IF NOT EXISTS idx_boq_elements_created ON boq_elements(created_at);
    CREATE INDEX IF NOT EXISTS idx_boq_elements_status ON boq_elements(status);

    CREATE TABLE IF NOT EXISTS boq_price_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      category_key TEXT,
      item_name TEXT NOT NULL,
      unit TEXT NOT NULL,
      material_price REAL NOT NULL DEFAULT 0,
      labor_price REAL NOT NULL DEFAULT 0,
      equipment_price REAL NOT NULL DEFAULT 0,
      transport_price REAL NOT NULL DEFAULT 0,
      supplier TEXT,
      region TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_boq_prices_project ON boq_price_items(project_id);
    CREATE INDEX IF NOT EXISTS idx_boq_prices_category ON boq_price_items(category_key);

    CREATE TABLE IF NOT EXISTS boq_imports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      file_name TEXT,
      file_type TEXT NOT NULL,
      total_rows INTEGER NOT NULL DEFAULT 0,
      imported_count INTEGER NOT NULL DEFAULT 0,
      rejected_count INTEGER NOT NULL DEFAULT 0,
      rejected_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_boq_imports_project ON boq_imports(project_id);

    CREATE TABLE IF NOT EXISTS boq_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      element_id INTEGER,
      action TEXT NOT NULL,
      before_json TEXT,
      after_json TEXT,
      actor TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_boq_audit_element ON boq_audit_log(element_id);
    CREATE INDEX IF NOT EXISTS idx_boq_audit_project ON boq_audit_log(project_id);
  `);

  seedBoqCategories(db);
}

// نزرع سجل الأصناف القياسي من lib/boq/categoryRegistry.js عند أول تشغيل (أو أي صنف جديد
// أُضيف للسجل في نسخة لاحقة) - INSERT OR IGNORE يجعل هذا آمناً للتكرار في كل إقلاع للتطبيق،
// ولا يمس أي صنف مخصّص أضافه المستخدم بنفس المفتاح.
function seedBoqCategories(db) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO boq_categories (key, trade, name_ar, calc_method, geometry_method, unit, default_waste_pct, fields_json, is_custom)
    VALUES (@key, @trade, @name_ar, @calc_method, @geometry_method, @unit, @default_waste_pct, @fields_json, 0)
  `);
  const insertMany = db.transaction((rows) => {
    for (const c of rows) {
      stmt.run({
        key: c.key,
        trade: c.trade,
        name_ar: c.name_ar,
        calc_method: c.calc_method,
        geometry_method: c.geometry_method || null,
        unit: c.unit,
        default_waste_pct: c.default_waste_pct ?? 5,
        fields_json: JSON.stringify(c.fields || []),
      });
    }
  });
  insertMany(BOQ_CATEGORIES);
}

// ---------- Projects ----------

export function listProjects() {
  return getDb().prepare(`SELECT * FROM projects ORDER BY updated_at DESC`).all();
}

export function getProject(id) {
  return getDb().prepare(`SELECT * FROM projects WHERE id = ?`).get(id);
}

export function createProject(data) {
  const stmt = getDb().prepare(`
    INSERT INTO projects (name, owner_name, contractor_name, consultant_name, engineer_name, location, logo_base64)
    VALUES (@name, @owner_name, @contractor_name, @consultant_name, @engineer_name, @location, @logo_base64)
  `);
  const info = stmt.run({
    name: data.name || 'مشروع بدون اسم',
    owner_name: data.owner_name || null,
    contractor_name: data.contractor_name || null,
    consultant_name: data.consultant_name || null,
    engineer_name: data.engineer_name || null,
    location: data.location || null,
    logo_base64: data.logo_base64 || null,
  });
  return getProject(info.lastInsertRowid);
}

// ---------- Calculations ----------

export function listCalculations({ calc_type, calc_type_prefix, project_id, limit = 200 } = {}) {
  let sql = `SELECT id, project_id, calc_type, title, engineer_name, status, created_at, updated_at FROM calculations WHERE 1=1`;
  const params = {};
  if (calc_type) {
    sql += ` AND calc_type = @calc_type`;
    params.calc_type = calc_type;
  }
  if (calc_type_prefix) {
    sql += ` AND calc_type LIKE @calc_type_prefix`;
    params.calc_type_prefix = `${calc_type_prefix}%`;
  }
  if (project_id) {
    sql += ` AND project_id = @project_id`;
    params.project_id = project_id;
  }
  sql += ` ORDER BY created_at DESC LIMIT @limit`;
  params.limit = limit;
  return getDb().prepare(sql).all(params);
}

export function getCalculation(id) {
  const row = getDb().prepare(`SELECT * FROM calculations WHERE id = ?`).get(id);
  if (!row) return null;
  return {
    ...row,
    inputs: JSON.parse(row.inputs_json),
    results: JSON.parse(row.results_json),
    warnings: row.warnings_json ? JSON.parse(row.warnings_json) : [],
  };
}

export function createCalculation(data) {
  const stmt = getDb().prepare(`
    INSERT INTO calculations
      (project_id, calc_type, title, engineer_name, signature_base64, inputs_json, results_json, warnings_json, status)
    VALUES
      (@project_id, @calc_type, @title, @engineer_name, @signature_base64, @inputs_json, @results_json, @warnings_json, @status)
  `);
  const info = stmt.run({
    project_id: data.project_id || null,
    calc_type: data.calc_type,
    title: data.title || null,
    engineer_name: data.engineer_name || null,
    signature_base64: data.signature_base64 || null,
    inputs_json: JSON.stringify(data.inputs || {}),
    results_json: JSON.stringify(data.results || {}),
    warnings_json: JSON.stringify(data.warnings || []),
    status: data.status || 'ok',
  });
  return getCalculation(info.lastInsertRowid);
}

export function deleteCalculation(id) {
  return getDb().prepare(`DELETE FROM calculations WHERE id = ?`).run(id);
}

export function getDashboardStats() {
  const db = getDb();
  const totals = db.prepare(`SELECT COUNT(*) AS total FROM calculations`).get();
  const byType = db
    .prepare(`SELECT calc_type, COUNT(*) AS count FROM calculations GROUP BY calc_type ORDER BY count DESC`)
    .all();
  const recent = db
    .prepare(
      `SELECT id, calc_type, title, engineer_name, created_at FROM calculations ORDER BY created_at DESC LIMIT 8`
    )
    .all();
  const projectsCount = db.prepare(`SELECT COUNT(*) AS total FROM projects`).get();
  return {
    totalCalculations: totals.total,
    totalProjects: projectsCount.total,
    byType,
    recent,
  };
}

// ---------- Steel price lists (القسم الثاني) ----------

export function listPriceLists() {
  return getDb().prepare(`SELECT * FROM steel_price_lists ORDER BY is_default DESC, updated_at DESC`).all();
}

export function getPriceList(id) {
  return getDb().prepare(`SELECT * FROM steel_price_lists WHERE id = ?`).get(id);
}

export function getDefaultPriceList() {
  return (
    getDb().prepare(`SELECT * FROM steel_price_lists WHERE is_default = 1 ORDER BY updated_at DESC LIMIT 1`).get() ||
    getDb().prepare(`SELECT * FROM steel_price_lists ORDER BY created_at ASC LIMIT 1`).get() ||
    null
  );
}

export function upsertPriceList(data) {
  const db = getDb();
  if (data.id) {
    db.prepare(
      `UPDATE steel_price_lists SET name=@name, project_id=@project_id, steel_price_per_ton=@steel_price_per_ton,
        cutting_price_per_ton=@cutting_price_per_ton, bending_price_per_ton=@bending_price_per_ton,
        installation_price_per_ton=@installation_price_per_ton, transport_price_per_ton=@transport_price_per_ton,
        tax_pct=@tax_pct, discount_pct=@discount_pct, is_default=@is_default, updated_at=datetime('now')
       WHERE id=@id`
    ).run(data);
    if (data.is_default) {
      db.prepare(`UPDATE steel_price_lists SET is_default = 0 WHERE id != @id`).run(data);
    }
    return getPriceList(data.id);
  }
  const info = db
    .prepare(
      `INSERT INTO steel_price_lists
        (project_id, name, steel_price_per_ton, cutting_price_per_ton, bending_price_per_ton, installation_price_per_ton, transport_price_per_ton, tax_pct, discount_pct, is_default)
       VALUES (@project_id, @name, @steel_price_per_ton, @cutting_price_per_ton, @bending_price_per_ton, @installation_price_per_ton, @transport_price_per_ton, @tax_pct, @discount_pct, @is_default)`
    )
    .run({
      project_id: data.project_id || null,
      name: data.name || 'قائمة أسعار جديدة',
      steel_price_per_ton: data.steel_price_per_ton || 0,
      cutting_price_per_ton: data.cutting_price_per_ton || 0,
      bending_price_per_ton: data.bending_price_per_ton || 0,
      installation_price_per_ton: data.installation_price_per_ton || 0,
      transport_price_per_ton: data.transport_price_per_ton || 0,
      tax_pct: data.tax_pct || 0,
      discount_pct: data.discount_pct || 0,
      is_default: data.is_default ? 1 : 0,
    });
  if (data.is_default) {
    db.prepare(`UPDATE steel_price_lists SET is_default = 0 WHERE id != ?`).run(info.lastInsertRowid);
  }
  return getPriceList(info.lastInsertRowid);
}

export function deletePriceList(id) {
  return getDb().prepare(`DELETE FROM steel_price_lists WHERE id = ?`).run(id);
}

export function getRebarDashboardStats() {
  const db = getDb();
  const rows = db.prepare(`SELECT calc_type, results_json FROM calculations WHERE calc_type LIKE 'rebar_%'`).all();
  let totalWeightKg = 0;
  let totalBars = 0;
  let totalCost = 0;
  let wasteSum = 0;
  let wasteCount = 0;
  const diameterTally = {};
  rows.forEach((r) => {
    try {
      const res = JSON.parse(r.results_json);
      const t = res?.totals;
      if (t) {
        totalWeightKg += t.totalWeightKg || 0;
        totalBars += t.totalBarCount || 0;
        totalCost += t.cost?.finalCost || 0;
        if (t.wastePct != null) {
          wasteSum += t.wastePct;
          wasteCount += 1;
        }
        if (t.weightByDiameter) {
          Object.entries(t.weightByDiameter).forEach(([d, w]) => {
            diameterTally[d] = (diameterTally[d] || 0) + w;
          });
        }
      }
    } catch {
      /* تجاهل السجلات التالفة */
    }
  });
  const byType = db
    .prepare(`SELECT calc_type, COUNT(*) AS count FROM calculations WHERE calc_type LIKE 'rebar_%' GROUP BY calc_type ORDER BY count DESC`)
    .all();
  const recent = db
    .prepare(
      `SELECT id, calc_type, title, engineer_name, created_at FROM calculations WHERE calc_type LIKE 'rebar_%' ORDER BY created_at DESC LIMIT 8`
    )
    .all();
  const topDiameters = Object.entries(diameterTally)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([diameter, weightKg]) => ({ diameter, weightKg: Math.round(weightKg * 10) / 10 }));

  return {
    totalCalculations: rows.length,
    totalWeightKg: Math.round(totalWeightKg * 10) / 10,
    totalWeightTon: Math.round((totalWeightKg / 1000) * 100) / 100,
    totalBars,
    totalCost: Math.round(totalCost * 100) / 100,
    avgWastePct: wasteCount ? Math.round((wasteSum / wasteCount) * 100) / 100 : 0,
    byType,
    recent,
    topDiameters,
  };
}

// تنسيق رقم التقرير - أُعيد تصديره هنا للتوافق مع الاستخدامات السابقة، لكن المصدر الفعلي lib/reportNumber.js
export function formatReportNumber(calc) {
  return formatReportNumberPure(calc);
}

// =============================================================================
// القسم الثالث: نظام حصر الكميات (Quantity Takeoff) - BOQ
// =============================================================================

// ---------- الأصناف (Categories) ----------

export function listBoqCategories() {
  return getDb()
    .prepare(`SELECT * FROM boq_categories ORDER BY trade, name_ar`)
    .all()
    .map((r) => ({ ...r, fields: JSON.parse(r.fields_json || '[]') }));
}

export function getBoqCategory(key) {
  const row = getDb().prepare(`SELECT * FROM boq_categories WHERE key = ?`).get(key);
  if (!row) return null;
  return { ...row, fields: JSON.parse(row.fields_json || '[]') };
}

/** إنشاء صنف مخصص جديد (خارج السجل القياسي الأساسي) - يلبي متطلب "إمكانية إنشاء عناصر مخصصة" */
export function createCustomBoqCategory(data) {
  const db = getDb();
  const key = data.key && String(data.key).trim() ? String(data.key).trim() : `custom_${randomUUID().slice(0, 8)}`;
  if (db.prepare(`SELECT key FROM boq_categories WHERE key = ?`).get(key)) {
    throw new Error(`مفتاح الصنف "${key}" مستخدم بالفعل.`);
  }
  db.prepare(
    `INSERT INTO boq_categories (key, trade, name_ar, calc_method, geometry_method, unit, default_waste_pct, fields_json, is_custom)
     VALUES (@key, @trade, @name_ar, @calc_method, @geometry_method, @unit, @default_waste_pct, @fields_json, 1)`
  ).run({
    key,
    trade: data.trade || 'custom',
    name_ar: data.name_ar || 'صنف مخصص',
    calc_method: data.calc_method || 'manual_quantity',
    geometry_method: data.geometry_method || null,
    unit: data.unit || 'ea',
    default_waste_pct: data.default_waste_pct ?? 0,
    fields_json: JSON.stringify(data.fields || [{ key: 'quantityManual', label: 'الكمية', type: 'number', required: true }]),
  });
  return getBoqCategory(key);
}

// ---------- عناصر حصر الكميات (Elements) ----------

function parseBoqElement(row) {
  if (!row) return null;
  return { ...row, dimensions: JSON.parse(row.dimensions_json || '{}'), materials: row.materials_json ? JSON.parse(row.materials_json) : null };
}

export function listBoqElements({ project_id, trade, category_key, search, status, page = 1, pageSize = 50 } = {}) {
  const db = getDb();
  let where = ' WHERE 1=1';
  const params = {};
  if (project_id) { where += ' AND e.project_id = @project_id'; params.project_id = project_id; }
  if (category_key) { where += ' AND e.category_key = @category_key'; params.category_key = category_key; }
  if (trade) { where += ' AND c.trade = @trade'; params.trade = trade; }
  if (status) { where += ' AND e.status = @status'; params.status = status; }
  if (search) { where += ' AND (e.name LIKE @search OR e.location_note LIKE @search)'; params.search = `%${search}%`; }

  const totalRow = db.prepare(`SELECT COUNT(*) AS total FROM boq_elements e JOIN boq_categories c ON c.key = e.category_key${where}`).get(params);
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(500, Math.max(1, Number(pageSize) || 50));
  const offset = (safePage - 1) * safePageSize;

  const rows = db
    .prepare(
      `SELECT e.*, c.trade AS trade, c.name_ar AS category_name_ar FROM boq_elements e JOIN boq_categories c ON c.key = e.category_key
       ${where} ORDER BY e.updated_at DESC LIMIT @limit OFFSET @offset`
    )
    .all({ ...params, limit: safePageSize, offset });

  return {
    rows: rows.map(parseBoqElement),
    total: totalRow.total,
    page: safePage,
    pageSize: safePageSize,
    totalPages: Math.max(1, Math.ceil(totalRow.total / safePageSize)),
  };
}

export function getBoqElement(id) {
  return parseBoqElement(getDb().prepare(`SELECT * FROM boq_elements WHERE id = ?`).get(id));
}

/** كل عناصر مشروع (أو كل العناصر إن لم يُحدَّد مشروع) بلا ترقيم صفحي - للاستخدام في التصدير فقط */
export function listAllBoqElementsForExport({ project_id, trade, category_key, status } = {}) {
  const db = getDb();
  let where = ' WHERE 1=1';
  const params = {};
  if (project_id) { where += ' AND e.project_id = @project_id'; params.project_id = project_id; }
  if (category_key) { where += ' AND e.category_key = @category_key'; params.category_key = category_key; }
  if (trade) { where += ' AND c.trade = @trade'; params.trade = trade; }
  if (status) { where += ' AND e.status = @status'; params.status = status; }
  const rows = db
    .prepare(
      `SELECT e.*, c.trade AS trade, c.name_ar AS category_name_ar FROM boq_elements e JOIN boq_categories c ON c.key = e.category_key
       ${where} ORDER BY c.trade, e.category_key, e.created_at`
    )
    .all(params);
  return rows.map(parseBoqElement);
}

/** يبحث عن عنصر بنفس (المشروع + الصنف + الاسم + الموقع) لتطبيق قاعدة "منع تكرار العنصر" */
export function findDuplicateBoqElement({ project_id, category_key, name, location_note }) {
  const row = getDb()
    .prepare(
      `SELECT * FROM boq_elements
       WHERE project_id IS @project_id AND category_key = @category_key
         AND lower(trim(name)) = lower(trim(@name))
         AND lower(trim(coalesce(location_note,''))) = lower(trim(coalesce(@location_note,'')))
       LIMIT 1`
    )
    .get({ project_id: project_id ?? null, category_key, name, location_note: location_note || '' });
  return parseBoqElement(row);
}

function writeBoqAudit(db, { project_id, element_id, action, before, after, actor }) {
  db.prepare(
    `INSERT INTO boq_audit_log (project_id, element_id, action, before_json, after_json, actor)
     VALUES (@project_id, @element_id, @action, @before_json, @after_json, @actor)`
  ).run({
    project_id: project_id ?? null,
    element_id: element_id ?? null,
    action,
    before_json: before ? JSON.stringify(before) : null,
    after_json: after ? JSON.stringify(after) : null,
    actor: actor || null,
  });
}

const insertBoqElementStmt = () =>
  getDb().prepare(
    `INSERT INTO boq_elements (
       uuid, project_id, category_key, linked_calculation_id, name, location_note, dimensions_json,
       quantity, unit, waste_pct, quantity_with_waste, unit_material_price, unit_labor_price,
       unit_equipment_price, unit_transport_price, tax_pct, discount_pct, total_cost, materials_json,
       source, source_ref, ai_confidence, status, notes
     ) VALUES (
       @uuid, @project_id, @category_key, @linked_calculation_id, @name, @location_note, @dimensions_json,
       @quantity, @unit, @waste_pct, @quantity_with_waste, @unit_material_price, @unit_labor_price,
       @unit_equipment_price, @unit_transport_price, @tax_pct, @discount_pct, @total_cost, @materials_json,
       @source, @source_ref, @ai_confidence, @status, @notes
     )`
  );

/** إنشاء عنصر حصر كميات جديد - داخل معاملة واحدة مع تسجيل سطر في سجل التدقيق (Audit Log) */
export function createBoqElement(data) {
  const db = getDb();
  const run = db.transaction(() => {
    const uuid = randomUUID();
    const info = insertBoqElementStmt().run({
      uuid,
      project_id: data.project_id || null,
      category_key: data.category_key,
      linked_calculation_id: data.linked_calculation_id || null,
      name: data.name,
      location_note: data.location_note || null,
      dimensions_json: JSON.stringify(data.dimensions || {}),
      quantity: data.quantity || 0,
      unit: data.unit,
      waste_pct: data.waste_pct || 0,
      quantity_with_waste: data.quantity_with_waste || 0,
      unit_material_price: data.unit_material_price || 0,
      unit_labor_price: data.unit_labor_price || 0,
      unit_equipment_price: data.unit_equipment_price || 0,
      unit_transport_price: data.unit_transport_price || 0,
      tax_pct: data.tax_pct || 0,
      discount_pct: data.discount_pct || 0,
      total_cost: data.total_cost || 0,
      materials_json: data.materials ? JSON.stringify(data.materials) : null,
      source: data.source || 'manual',
      source_ref: data.source_ref || null,
      ai_confidence: data.ai_confidence ?? null,
      status: data.status || 'confirmed',
      notes: data.notes || null,
    });
    const created = getBoqElement(info.lastInsertRowid);
    writeBoqAudit(db, { project_id: created.project_id, element_id: created.id, action: 'create', before: null, after: created, actor: data.actor });
    return created;
  });
  return run();
}

/** تحديث عنصر - يحفظ الحالة قبل وبعد في سجل التدقيق دائماً */
export function updateBoqElement(id, data) {
  const db = getDb();
  const run = db.transaction(() => {
    const before = getBoqElement(id);
    if (!before) throw new Error('العنصر غير موجود.');
    const merged = { ...before, ...data };
    db.prepare(
      `UPDATE boq_elements SET
         category_key=@category_key, linked_calculation_id=@linked_calculation_id, name=@name,
         location_note=@location_note, dimensions_json=@dimensions_json, quantity=@quantity, unit=@unit,
         waste_pct=@waste_pct, quantity_with_waste=@quantity_with_waste, unit_material_price=@unit_material_price,
         unit_labor_price=@unit_labor_price, unit_equipment_price=@unit_equipment_price,
         unit_transport_price=@unit_transport_price, tax_pct=@tax_pct, discount_pct=@discount_pct,
         total_cost=@total_cost, materials_json=@materials_json, status=@status, notes=@notes,
         updated_at=datetime('now')
       WHERE id=@id`
    ).run({
      id,
      category_key: merged.category_key,
      linked_calculation_id: data.linked_calculation_id !== undefined ? data.linked_calculation_id : before.linked_calculation_id,
      name: merged.name,
      location_note: merged.location_note || null,
      dimensions_json: JSON.stringify(data.dimensions || before.dimensions || {}),
      quantity: merged.quantity || 0,
      unit: merged.unit,
      waste_pct: merged.waste_pct || 0,
      quantity_with_waste: merged.quantity_with_waste || 0,
      unit_material_price: merged.unit_material_price || 0,
      unit_labor_price: merged.unit_labor_price || 0,
      unit_equipment_price: merged.unit_equipment_price || 0,
      unit_transport_price: merged.unit_transport_price || 0,
      tax_pct: merged.tax_pct || 0,
      discount_pct: merged.discount_pct || 0,
      total_cost: merged.total_cost || 0,
      materials_json: data.materials !== undefined ? (data.materials ? JSON.stringify(data.materials) : null) : before.materials ? JSON.stringify(before.materials) : null,
      status: merged.status || 'confirmed',
      notes: merged.notes || null,
    });
    const after = getBoqElement(id);
    writeBoqAudit(db, { project_id: after.project_id, element_id: id, action: 'update', before, after, actor: data.actor });
    return after;
  });
  return run();
}

/** حذف عنصر - يحفظ نسخة "قبل الحذف" كاملة في سجل التدقيق حتى بعد زوال السجل الأصلي */
export function deleteBoqElement(id, actor) {
  const db = getDb();
  const run = db.transaction(() => {
    const before = getBoqElement(id);
    if (!before) return { deleted: false };
    db.prepare(`DELETE FROM boq_elements WHERE id = ?`).run(id);
    writeBoqAudit(db, { project_id: before.project_id, element_id: id, action: 'delete', before, after: null, actor });
    return { deleted: true };
  });
  return run();
}

/**
 * إدراج دفعة عناصر مستوردة (Excel/CSV/DXF/IFC) داخل معاملة واحدة - يتحقق من التكرار لكل
 * صف ما لم يُسمح صراحة بذلك (allowDuplicates)، ويُعيد قائمتي المُدرَج والمرفوض مع الأسباب.
 */
export function bulkInsertBoqElements(project_id, rows, { source = 'import', sourceRef = null, allowDuplicates = false, actor = null } = {}) {
  const db = getDb();
  const run = db.transaction(() => {
    const inserted = [];
    const skipped = [];
    for (const row of rows) {
      if (!allowDuplicates) {
        const dup = findDuplicateBoqElement({ project_id, category_key: row.category_key, name: row.name, location_note: row.location_note });
        if (dup) {
          skipped.push({ row, reason: 'عنصر مكرر (نفس الاسم والصنف والموقع داخل المشروع)' });
          continue;
        }
      }
      inserted.push(createBoqElement({ ...row, project_id, source, source_ref: sourceRef, actor }));
    }
    return { inserted, skipped };
  });
  return run();
}

// ---------- مكتبة أسعار حصر الكميات (تخصصات المشروع كافة، بخلاف حديد التسليح الذي له مكتبته الخاصة أعلاه) ----------

export function listBoqPriceItems({ project_id } = {}) {
  const db = getDb();
  if (project_id) {
    return db
      .prepare(`SELECT * FROM boq_price_items WHERE project_id = @project_id OR project_id IS NULL ORDER BY is_default DESC, updated_at DESC`)
      .all({ project_id });
  }
  return db.prepare(`SELECT * FROM boq_price_items ORDER BY is_default DESC, updated_at DESC`).all();
}

export function getBoqPriceItem(id) {
  return getDb().prepare(`SELECT * FROM boq_price_items WHERE id = ?`).get(id);
}

export function upsertBoqPriceItem(data) {
  const db = getDb();
  if (data.id) {
    db.prepare(
      `UPDATE boq_price_items SET project_id=@project_id, category_key=@category_key, item_name=@item_name, unit=@unit,
         material_price=@material_price, labor_price=@labor_price, equipment_price=@equipment_price,
         transport_price=@transport_price, supplier=@supplier, region=@region, is_default=@is_default,
         updated_at=datetime('now')
       WHERE id=@id`
    ).run({
      id: data.id,
      project_id: data.project_id || null,
      category_key: data.category_key || null,
      item_name: data.item_name,
      unit: data.unit,
      material_price: data.material_price || 0,
      labor_price: data.labor_price || 0,
      equipment_price: data.equipment_price || 0,
      transport_price: data.transport_price || 0,
      supplier: data.supplier || null,
      region: data.region || null,
      is_default: data.is_default ? 1 : 0,
    });
    return getBoqPriceItem(data.id);
  }
  const info = db
    .prepare(
      `INSERT INTO boq_price_items (uuid, project_id, category_key, item_name, unit, material_price, labor_price, equipment_price, transport_price, supplier, region, is_default)
       VALUES (@uuid, @project_id, @category_key, @item_name, @unit, @material_price, @labor_price, @equipment_price, @transport_price, @supplier, @region, @is_default)`
    )
    .run({
      uuid: randomUUID(),
      project_id: data.project_id || null,
      category_key: data.category_key || null,
      item_name: data.item_name || 'بند سعر جديد',
      unit: data.unit || 'ea',
      material_price: data.material_price || 0,
      labor_price: data.labor_price || 0,
      equipment_price: data.equipment_price || 0,
      transport_price: data.transport_price || 0,
      supplier: data.supplier || null,
      region: data.region || null,
      is_default: data.is_default ? 1 : 0,
    });
  return getBoqPriceItem(info.lastInsertRowid);
}

export function deleteBoqPriceItem(id) {
  return getDb().prepare(`DELETE FROM boq_price_items WHERE id = ?`).run(id);
}

// ---------- سجلات الاستيراد ----------

export function createBoqImportLog(data) {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO boq_imports (project_id, file_name, file_type, total_rows, imported_count, rejected_count, rejected_json)
       VALUES (@project_id, @file_name, @file_type, @total_rows, @imported_count, @rejected_count, @rejected_json)`
    )
    .run({
      project_id: data.project_id || null,
      file_name: data.file_name || null,
      file_type: data.file_type,
      total_rows: data.total_rows || 0,
      imported_count: data.imported_count || 0,
      rejected_count: data.rejected_count || 0,
      rejected_json: JSON.stringify(data.rejected || []),
    });
  return db.prepare(`SELECT * FROM boq_imports WHERE id = ?`).get(info.lastInsertRowid);
}

export function listBoqImports(project_id) {
  const db = getDb();
  const rows = project_id
    ? db.prepare(`SELECT * FROM boq_imports WHERE project_id = ? ORDER BY created_at DESC`).all(project_id)
    : db.prepare(`SELECT * FROM boq_imports ORDER BY created_at DESC LIMIT 100`).all();
  return rows.map((r) => ({ ...r, rejected: JSON.parse(r.rejected_json || '[]') }));
}

// ---------- سجل التدقيق (Audit Log) ----------

export function listBoqAuditLog({ project_id, element_id, limit = 100 } = {}) {
  const db = getDb();
  let sql = `SELECT * FROM boq_audit_log WHERE 1=1`;
  const params = {};
  if (project_id) { sql += ` AND project_id = @project_id`; params.project_id = project_id; }
  if (element_id) { sql += ` AND element_id = @element_id`; params.element_id = element_id; }
  sql += ` ORDER BY created_at DESC LIMIT @limit`;
  params.limit = limit;
  return db
    .prepare(sql)
    .all(params)
    .map((r) => ({ ...r, before: r.before_json ? JSON.parse(r.before_json) : null, after: r.after_json ? JSON.parse(r.after_json) : null }));
}

// ---------- لوحة تحكم حصر الكميات ----------

export function getBoqDashboardStats(project_id) {
  const db = getDb();
  const scope = project_id ? ' WHERE e.project_id = @project_id' : '';
  const params = project_id ? { project_id } : {};

  const totals = db.prepare(`SELECT COUNT(*) AS totalElements, COALESCE(SUM(total_cost),0) AS totalCost FROM boq_elements e${scope}`).get(params);
  const byTrade = db
    .prepare(
      `SELECT c.trade AS trade, COUNT(*) AS count, COALESCE(SUM(e.total_cost),0) AS cost
       FROM boq_elements e JOIN boq_categories c ON c.key = e.category_key
       ${scope} GROUP BY c.trade ORDER BY cost DESC`
    )
    .all(params);
  const byCategory = db
    .prepare(
      `SELECT e.category_key AS category_key, c.name_ar AS name_ar, c.unit AS unit, COUNT(*) AS count,
              COALESCE(SUM(e.quantity_with_waste),0) AS totalQuantity, COALESCE(SUM(e.total_cost),0) AS cost
       FROM boq_elements e JOIN boq_categories c ON c.key = e.category_key
       ${scope} GROUP BY e.category_key ORDER BY cost DESC LIMIT 8`
    )
    .all(params);
  const recent = db
    .prepare(
      `SELECT e.id, e.name, e.category_key, c.name_ar AS category_name_ar, e.quantity_with_waste, e.unit, e.total_cost, e.created_at
       FROM boq_elements e JOIN boq_categories c ON c.key = e.category_key
       ${scope} ORDER BY e.created_at DESC LIMIT 8`
    )
    .all(params);
  const projectsWithElements = project_id
    ? 1
    : db.prepare(`SELECT COUNT(DISTINCT project_id) AS n FROM boq_elements WHERE project_id IS NOT NULL`).get().n;

  return {
    totalElements: totals.totalElements,
    totalCost: Math.round(totals.totalCost * 100) / 100,
    projectsWithElements,
    byTrade,
    byCategory,
    recent,
  };
}
