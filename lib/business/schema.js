// lib/business/schema.js
// =============================================================================
// القسم السادس: نظام إدارة الأعمال (Business Management System) — طبقة المخطط.
//
// نفس نمط lib/pm/schema.js تماماً: يعيد استخدام اتصال SQLite الموحّد (lib/db.js:getDb)
// بدل فتح اتصال منفصل - هذا هو "قاعدة بيانات مركزية واحدة" في مواصفة القسم. لا يُعدَّل
// lib/db.js ولا lib/pm/schema.js ولا lib/schedule/schema.js إطلاقاً (تفادياً لأي تأثير على
// الأقسام 1-5 العاملة فعلياً)؛ بدلاً من ذلك:
//   - يوسّع هذا الملف جدول `projects` الموجود بعمود client_id فقط (ALTER TABLE ADD COLUMN
//     idempotent) لربط كل مشروع تنفيذي بعميل CRM حقيقي من biz_clients - هذا هو "عدم تكرار
//     بيانات العميل" (البند 24) بدل عمود client_name النصي الحر المستخدم سابقاً في القسم
//     الرابع (يبقى كحقل احتياطي/عرض لمشاريع لم تُربط بعد بعميل رسمي).
//   - يضيف جداول جديدة كلها ببادئة `biz_` (بنفس نمط `pm_`/`sch_`)، معزولة تماماً عن غيرها.
// =============================================================================

import { getDb } from '../db.js';

const globalForBiz = globalThis;

function migrateProjectsColumnsForBusiness(db) {
  const existing = new Set(db.prepare(`PRAGMA table_info(projects)`).all().map((c) => c.name));
  if (!existing.has('client_id')) {
    db.exec(`ALTER TABLE projects ADD COLUMN client_id INTEGER REFERENCES biz_clients(id)`);
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id)`);
}

function createBusinessTables(db) {
  db.exec(`
    -- ============== العملاء (CRM) - البند الثاني ==============
    CREATE TABLE IF NOT EXISTS biz_clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      client_code TEXT,
      name TEXT NOT NULL,
      client_type TEXT NOT NULL DEFAULT 'company',
      status TEXT NOT NULL DEFAULT 'active',
      phone TEXT,
      email TEXT,
      website TEXT,
      address TEXT,
      city TEXT,
      country TEXT,
      contact_person TEXT,
      contact_title TEXT,
      rating INTEGER,
      source TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_biz_clients_code_unique ON biz_clients(client_code) WHERE client_code IS NOT NULL AND client_code != '';
    CREATE INDEX IF NOT EXISTS idx_biz_clients_status ON biz_clients(status);
    CREATE INDEX IF NOT EXISTS idx_biz_clients_name ON biz_clients(name);

    CREATE TABLE IF NOT EXISTS biz_client_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      client_id INTEGER NOT NULL REFERENCES biz_clients(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      title TEXT,
      phone TEXT,
      email TEXT,
      is_primary INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_biz_contacts_client ON biz_client_contacts(client_id);

    -- ============== الفرص التجارية - البند الثالث ==============
    CREATE TABLE IF NOT EXISTS biz_opportunities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      opp_code TEXT,
      client_id INTEGER NOT NULL REFERENCES biz_clients(id) ON DELETE CASCADE,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      source TEXT,
      expected_value REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'SAR',
      opp_date TEXT,
      expected_close_date TEXT,
      responsible TEXT,
      win_probability INTEGER NOT NULL DEFAULT 10,
      stage TEXT NOT NULL DEFAULT 'new',
      lost_reason TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_biz_opp_code_unique ON biz_opportunities(opp_code) WHERE opp_code IS NOT NULL AND opp_code != '';
    CREATE INDEX IF NOT EXISTS idx_biz_opp_client ON biz_opportunities(client_id);
    CREATE INDEX IF NOT EXISTS idx_biz_opp_stage ON biz_opportunities(stage);

    -- ============== عروض الأسعار - البند الرابع ==============
    CREATE TABLE IF NOT EXISTS biz_quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      quote_no TEXT,
      client_id INTEGER NOT NULL REFERENCES biz_clients(id) ON DELETE CASCADE,
      opportunity_id INTEGER REFERENCES biz_opportunities(id) ON DELETE SET NULL,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      issue_date TEXT,
      validity_date TEXT,
      payment_terms TEXT,
      execution_duration_days REAL,
      subtotal REAL NOT NULL DEFAULT 0,
      discount_pct REAL NOT NULL DEFAULT 0,
      discount_value REAL NOT NULL DEFAULT 0,
      tax_pct REAL NOT NULL DEFAULT 0,
      tax_value REAL NOT NULL DEFAULT 0,
      other_costs REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'SAR',
      notes TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_biz_quote_no_unique ON biz_quotes(quote_no) WHERE quote_no IS NOT NULL AND quote_no != '';
    CREATE INDEX IF NOT EXISTS idx_biz_quotes_client ON biz_quotes(client_id);
    CREATE INDEX IF NOT EXISTS idx_biz_quotes_opp ON biz_quotes(opportunity_id);
    CREATE INDEX IF NOT EXISTS idx_biz_quotes_status ON biz_quotes(status);

    CREATE TABLE IF NOT EXISTS biz_quote_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id INTEGER NOT NULL REFERENCES biz_quotes(id) ON DELETE CASCADE,
      boq_element_id INTEGER REFERENCES boq_elements(id) ON DELETE SET NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      description TEXT NOT NULL,
      unit TEXT,
      quantity REAL NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL DEFAULT 0,
      discount_pct REAL NOT NULL DEFAULT 0,
      tax_pct REAL NOT NULL DEFAULT 0,
      line_total REAL NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_biz_quote_items_quote ON biz_quote_items(quote_id);
    CREATE INDEX IF NOT EXISTS idx_biz_quote_items_boq ON biz_quote_items(boq_element_id);

    -- ============== العقود - البند الخامس ==============
    CREATE TABLE IF NOT EXISTS biz_contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      contract_no TEXT,
      client_id INTEGER NOT NULL REFERENCES biz_clients(id) ON DELETE CASCADE,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      quote_id INTEGER REFERENCES biz_quotes(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      scope_of_work TEXT,
      original_value REAL NOT NULL DEFAULT 0,
      current_value REAL NOT NULL DEFAULT 0,
      start_date TEXT,
      end_date TEXT,
      duration_days REAL,
      payment_terms TEXT,
      warranties TEXT,
      obligations TEXT,
      special_terms TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_biz_contract_no_unique ON biz_contracts(contract_no) WHERE contract_no IS NOT NULL AND contract_no != '';
    CREATE INDEX IF NOT EXISTS idx_biz_contracts_client ON biz_contracts(client_id);
    CREATE INDEX IF NOT EXISTS idx_biz_contracts_project ON biz_contracts(project_id);
    CREATE INDEX IF NOT EXISTS idx_biz_contracts_status ON biz_contracts(status);

    -- ============== أوامر التغيير التجارية - البند العاشر ==============
    CREATE TABLE IF NOT EXISTS biz_change_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      co_no TEXT,
      contract_id INTEGER NOT NULL REFERENCES biz_contracts(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      reason TEXT,
      delta_value REAL NOT NULL DEFAULT 0,
      duration_impact_days REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      requested_by TEXT,
      decided_by TEXT,
      decided_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_biz_co_contract ON biz_change_orders(contract_id);
    CREATE INDEX IF NOT EXISTS idx_biz_co_status ON biz_change_orders(status);

    -- ============== المستخلصات والدفعات - البند التاسع ==============
    CREATE TABLE IF NOT EXISTS biz_progress_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      certificate_no TEXT,
      contract_id INTEGER NOT NULL REFERENCES biz_contracts(id) ON DELETE CASCADE,
      period_from TEXT,
      period_to TEXT,
      work_value_to_date REAL NOT NULL DEFAULT 0,
      previous_work_value REAL NOT NULL DEFAULT 0,
      retention_pct REAL NOT NULL DEFAULT 0,
      retention_amount REAL NOT NULL DEFAULT 0,
      other_deductions REAL NOT NULL DEFAULT 0,
      previous_payments_total REAL NOT NULL DEFAULT 0,
      net_due REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      submitted_by TEXT,
      approved_by TEXT,
      approved_at TEXT,
      paid_at TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_biz_pp_contract ON biz_progress_payments(contract_id);
    CREATE INDEX IF NOT EXISTS idx_biz_pp_status ON biz_progress_payments(status);

    -- ============== المقاولون والموردون (موحّدة - partner_type) - البندان 6 و7 ==============
    CREATE TABLE IF NOT EXISTS biz_partners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      partner_code TEXT,
      partner_type TEXT NOT NULL DEFAULT 'contractor',
      company_name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      specialty TEXT,
      materials_services TEXT,
      price_notes TEXT,
      insurance_info TEXT,
      certifications TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      rating_quality REAL,
      rating_schedule REAL,
      rating_cost REAL,
      rating_safety REAL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_biz_partner_code_unique ON biz_partners(partner_code) WHERE partner_code IS NOT NULL AND partner_code != '';
    CREATE INDEX IF NOT EXISTS idx_biz_partners_type ON biz_partners(partner_type);
    CREATE INDEX IF NOT EXISTS idx_biz_partners_status ON biz_partners(status);

    CREATE TABLE IF NOT EXISTS biz_partner_evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partner_id INTEGER NOT NULL REFERENCES biz_partners(id) ON DELETE CASCADE,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      quality REAL NOT NULL,
      schedule_adherence REAL NOT NULL,
      cost REAL NOT NULL,
      safety REAL NOT NULL,
      overall_notes TEXT,
      evaluated_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_biz_partner_eval_partner ON biz_partner_evaluations(partner_id);

    -- ============== أوامر العمل - البند الثامن ==============
    CREATE TABLE IF NOT EXISTS biz_work_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      wo_no TEXT,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      client_id INTEGER REFERENCES biz_clients(id) ON DELETE SET NULL,
      contract_id INTEGER REFERENCES biz_contracts(id) ON DELETE SET NULL,
      partner_id INTEGER REFERENCES biz_partners(id) ON DELETE SET NULL,
      activity TEXT NOT NULL,
      description TEXT,
      responsible TEXT,
      issue_date TEXT,
      due_date TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'new',
      cost REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_biz_wo_no_unique ON biz_work_orders(wo_no) WHERE wo_no IS NOT NULL AND wo_no != '';
    CREATE INDEX IF NOT EXISTS idx_biz_wo_project ON biz_work_orders(project_id);
    CREATE INDEX IF NOT EXISTS idx_biz_wo_contract ON biz_work_orders(contract_id);
    CREATE INDEX IF NOT EXISTS idx_biz_wo_status ON biz_work_orders(status);

    -- ============== المراسلات - البند الحادي عشر ==============
    CREATE TABLE IF NOT EXISTS biz_correspondence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      ref_no TEXT,
      direction TEXT NOT NULL DEFAULT 'outgoing',
      client_id INTEGER REFERENCES biz_clients(id) ON DELETE SET NULL,
      contract_id INTEGER REFERENCES biz_contracts(id) ON DELETE SET NULL,
      opportunity_id INTEGER REFERENCES biz_opportunities(id) ON DELETE SET NULL,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      subject TEXT NOT NULL,
      body TEXT,
      sender TEXT,
      recipient TEXT,
      correspondence_date TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_biz_corr_client ON biz_correspondence(client_id);
    CREATE INDEX IF NOT EXISTS idx_biz_corr_contract ON biz_correspondence(contract_id);
    CREATE INDEX IF NOT EXISTS idx_biz_corr_status ON biz_correspondence(status);

    -- ============== الاجتماعات - البند الثاني عشر ==============
    CREATE TABLE IF NOT EXISTS biz_meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      meeting_date TEXT,
      location TEXT,
      client_id INTEGER REFERENCES biz_clients(id) ON DELETE SET NULL,
      opportunity_id INTEGER REFERENCES biz_opportunities(id) ON DELETE SET NULL,
      contract_id INTEGER REFERENCES biz_contracts(id) ON DELETE SET NULL,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      attendees_json TEXT NOT NULL DEFAULT '[]',
      agenda TEXT,
      minutes TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_biz_meetings_client ON biz_meetings(client_id);

    CREATE TABLE IF NOT EXISTS biz_meeting_decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id INTEGER NOT NULL REFERENCES biz_meetings(id) ON DELETE CASCADE,
      decision_text TEXT NOT NULL,
      responsible TEXT,
      due_date TEXT,
      generated_task_id INTEGER REFERENCES pm_tasks(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_biz_decisions_meeting ON biz_meeting_decisions(meeting_id);

    -- ============== المستندات (مرتبطة بأي كيان) ==============
    CREATE TABLE IF NOT EXISTS biz_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      category TEXT,
      name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL DEFAULT 0,
      mime_type TEXT,
      status TEXT NOT NULL DEFAULT 'pending_approval',
      uploaded_by TEXT,
      approved_by TEXT,
      approved_at TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_biz_docs_entity ON biz_documents(entity_type, entity_id);

    -- ============== الالتزامات - البند الثالث عشر ==============
    CREATE TABLE IF NOT EXISTS biz_commitments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      responsible TEXT,
      due_date TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'open',
      required_action TEXT,
      related_document_id INTEGER REFERENCES biz_documents(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_biz_commitments_entity ON biz_commitments(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_biz_commitments_status ON biz_commitments(status);
    CREATE INDEX IF NOT EXISTS idx_biz_commitments_due ON biz_commitments(due_date);

    -- ============== سجل موافقات عام (Workflow) - البند الثامن عشر ==============
    CREATE TABLE IF NOT EXISTS biz_approvals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      decision TEXT,
      notes TEXT,
      actor TEXT,
      actor_role TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_biz_approvals_entity ON biz_approvals(entity_type, entity_id);

    -- ============== التنبيهات - البند الحادي والعشرون ==============
    CREATE TABLE IF NOT EXISTS biz_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
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
    CREATE INDEX IF NOT EXISTS idx_biz_notif_read ON biz_notifications(is_read);

    CREATE TABLE IF NOT EXISTS biz_report_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_type TEXT NOT NULL,
      format TEXT NOT NULL DEFAULT 'view',
      generated_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS biz_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      action TEXT NOT NULL,
      before_json TEXT,
      after_json TEXT,
      actor TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_biz_audit_entity ON biz_audit_log(entity_type, entity_id);
  `);
}

function ensureBusinessSchema() {
  if (globalForBiz.__bizSchemaReady) return;
  const db = getDb();
  createBusinessTables(db); // يجب أن يسبق ALTER TABLE projects (مرجع client_id إلى biz_clients)
  migrateProjectsColumnsForBusiness(db);
  globalForBiz.__bizSchemaReady = true;
}

/** يُعيد اتصال قاعدة البيانات الموحّد، بعد التأكد من جاهزية مخطط القسم السادس (idempotent). */
export function bdb() {
  ensureBusinessSchema();
  return getDb();
}

// ثوابت الحالات المستخدمة عبر وحدات القسم السادس - مصدر واحد لتفادي تكرارها.
export const CLIENT_TYPES = ['company', 'individual', 'government'];
export const CLIENT_STATUSES = ['active', 'inactive', 'blacklisted'];
export const OPPORTUNITY_STAGES = ['new', 'qualified', 'study', 'quote', 'negotiation', 'won', 'lost'];
export const QUOTE_STATUSES = ['draft', 'sent', 'under_review', 'negotiation', 'won', 'lost', 'expired'];
export const CONTRACT_STATUSES = ['draft', 'under_review', 'pending_approval', 'active', 'completed', 'terminated', 'cancelled'];
export const CHANGE_ORDER_STATUSES = ['draft', 'pending_approval', 'approved', 'rejected'];
export const PROGRESS_PAYMENT_STATUSES = ['draft', 'submitted', 'pending_approval', 'approved', 'paid', 'rejected'];
export const PARTNER_TYPES = ['contractor', 'supplier'];
export const PARTNER_STATUSES = ['active', 'inactive', 'blacklisted', 'under_review'];
export const WORK_ORDER_STATUSES = ['new', 'approved', 'in_progress', 'completed', 'closed'];
export const CORRESPONDENCE_DIRECTIONS = ['incoming', 'outgoing', 'internal', 'email', 'notice'];
export const CORRESPONDENCE_STATUSES = ['open', 'pending_reply', 'closed'];
export const COMMITMENT_STATUSES = ['open', 'done', 'overdue', 'cancelled'];
export const DOCUMENT_STATUSES = ['pending_approval', 'approved', 'rejected'];
export const PRIORITIES = ['low', 'medium', 'high', 'critical'];
