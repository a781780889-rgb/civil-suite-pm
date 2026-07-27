// lib/business/db/partners.js — إدارة المقاولين والموردين، البندان السادس والسابع من القواعد
// الإلزامية. جدول موحّد (partner_type) بدل جدولين متطابقَي البنية تقريباً - قابل للتصفية بحسب
// النوع من الواجهة (صفحتان منفصلتان: /partners?type=contractor و/partners?type=supplier)
// دون ازدواج مخطط قاعدة البيانات ولا منطق CRUD (نفس فلسفة biz_payment لأمري التغيير/المستخلصات).
import { randomUUID } from 'crypto';
import { bdb, PARTNER_STATUSES, PARTNER_TYPES } from '../schema.js';
import { writeBizAudit } from './audit.js';
import { computePartnerOverallRating } from '../calc.js';

const FIELDS = [
  'partner_code', 'partner_type', 'company_name', 'contact_person', 'phone', 'email', 'address',
  'specialty', 'materials_services', 'price_notes', 'insurance_info', 'certifications', 'status', 'notes',
];

function normalize(data) {
  const out = {};
  for (const f of FIELDS) out[f] = data[f] !== undefined ? data[f] : null;
  if (!out.company_name) throw new Error('اسم الشركة/المقاول/المورد مطلوب.');
  out.partner_type = PARTNER_TYPES.includes(out.partner_type) ? out.partner_type : 'contractor';
  out.status = PARTNER_STATUSES.includes(out.status) ? out.status : 'active';
  return out;
}

export function findDuplicatePartner({ partner_code, company_name, phone }, excludeId) {
  const db = bdb();
  if (partner_code) {
    const row = excludeId
      ? db.prepare(`SELECT * FROM biz_partners WHERE partner_code=@c AND id != @id`).get({ c: partner_code, id: excludeId })
      : db.prepare(`SELECT * FROM biz_partners WHERE partner_code=@c`).get({ c: partner_code });
    if (row) return row;
  }
  if (company_name && phone) {
    const row = db.prepare(`SELECT * FROM biz_partners WHERE lower(company_name)=lower(@n) AND phone=@p AND id != @id`).get({ n: company_name, p: phone, id: excludeId || 0 });
    if (row) return row;
  }
  return null;
}

export function createPartner(data) {
  const db = bdb();
  const run = db.transaction(() => {
    const n = normalize(data);
    const uuid = randomUUID();
    const info = db
      .prepare(`INSERT INTO biz_partners (uuid, ${FIELDS.join(', ')}) VALUES (@uuid, ${FIELDS.map((f) => '@' + f).join(', ')})`)
      .run({ uuid, ...n });
    const created = getPartnerById(info.lastInsertRowid);
    writeBizAudit(db, { entity_type: 'partner', entity_id: created.id, action: 'create', before: null, after: created, actor: data.actor });
    return created;
  });
  return run();
}

export function updatePartner(id, data) {
  const db = bdb();
  const run = db.transaction(() => {
    const before = getPartnerById(id);
    if (!before) throw new Error('الشريك غير موجود.');
    const merged = { ...before, ...data };
    const n = normalize(merged);
    db.prepare(`UPDATE biz_partners SET ${FIELDS.map((f) => `${f}=@${f}`).join(', ')}, updated_at=datetime('now') WHERE id=@id`).run({ ...n, id });
    const after = getPartnerById(id);
    writeBizAudit(db, { entity_type: 'partner', entity_id: id, action: 'update', before, after, actor: data.actor });
    return after;
  });
  return run();
}

export function getPartnerById(id) {
  const db = bdb();
  const partner = db.prepare(`SELECT * FROM biz_partners WHERE id = ?`).get(id);
  if (!partner) return null;
  partner.evaluations = db.prepare(`SELECT * FROM biz_partner_evaluations WHERE partner_id = ? ORDER BY created_at DESC`).all(id);
  partner.overallRating = computePartnerOverallRating(partner.evaluations);
  return partner;
}

export function listPartnersPaged({ partner_type, status, search, page = 1, pageSize = 30 } = {}) {
  const db = bdb();
  let where = ' WHERE 1=1';
  const params = {};
  if (partner_type) { where += ' AND partner_type = @partner_type'; params.partner_type = partner_type; }
  if (status) { where += ' AND status = @status'; params.status = status; }
  if (search) { where += ' AND (company_name LIKE @search OR partner_code LIKE @search OR specialty LIKE @search)'; params.search = `%${search}%`; }
  const total = db.prepare(`SELECT COUNT(*) AS n FROM biz_partners${where}`).get(params).n;
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(200, Math.max(1, Number(pageSize) || 30));
  const rows = db
    .prepare(`SELECT * FROM biz_partners${where} ORDER BY updated_at DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: safePageSize, offset: (safePage - 1) * safePageSize });
  return { rows, total, page: safePage, pageSize: safePageSize, totalPages: Math.max(1, Math.ceil(total / safePageSize)) };
}

export function setPartnerStatus(id, status, actor) {
  if (!PARTNER_STATUSES.includes(status)) throw new Error(`حالة شريك غير معروفة: ${status}`);
  const db = bdb();
  const run = db.transaction(() => {
    const before = getPartnerById(id);
    if (!before) throw new Error('الشريك غير موجود.');
    db.prepare(`UPDATE biz_partners SET status=@status, updated_at=datetime('now') WHERE id=@id`).run({ id, status });
    const after = getPartnerById(id);
    writeBizAudit(db, { entity_type: 'partner', entity_id: id, action: 'status_change', before: { status: before.status }, after: { status }, actor });
    return after;
  });
  return run();
}

/** تقييم شريك بناءً على الجودة/الالتزام بالجدول/التكلفة/السلامة (البند السادس). */
export function addPartnerEvaluation(partnerId, data) {
  const db = bdb();
  const run = db.transaction(() => {
    if (!getPartnerById(partnerId)) throw new Error('الشريك غير موجود.');
    for (const f of ['quality', 'schedule_adherence', 'cost', 'safety']) {
      const v = Number(data[f]);
      if (!Number.isFinite(v) || v < 1 || v > 5) throw new Error(`قيمة "${f}" يجب أن تكون رقماً بين 1 و5.`);
    }
    const info = db
      .prepare(
        `INSERT INTO biz_partner_evaluations (partner_id, project_id, quality, schedule_adherence, cost, safety, overall_notes, evaluated_by)
         VALUES (@partner_id, @project_id, @quality, @schedule_adherence, @cost, @safety, @overall_notes, @evaluated_by)`
      )
      .run({
        partner_id: partnerId, project_id: data.project_id || null, quality: Number(data.quality),
        schedule_adherence: Number(data.schedule_adherence), cost: Number(data.cost), safety: Number(data.safety),
        overall_notes: data.overall_notes || null, evaluated_by: data.actor || null,
      });
    const created = db.prepare(`SELECT * FROM biz_partner_evaluations WHERE id = ?`).get(info.lastInsertRowid);
    // تحديث أعمدة التقييم المخزَّنة (rating_*) في biz_partners لتعكس متوسط كل التقييمات حتى الآن -
    // تُقرأ مباشرة (SELECT *) من كل من صفحة قائمة الشركاء (نجمة التقييم) وتقارير المقاولين/الموردين
    // عبر listPartnersPaged()، وكانت تبقى فارغة دائماً لعدم وجود أي كتابة إليها سابقاً.
    const allEvals = db.prepare(`SELECT * FROM biz_partner_evaluations WHERE partner_id = ?`).all(partnerId);
    const avg = computePartnerOverallRating(allEvals);
    db.prepare(
      `UPDATE biz_partners SET rating_quality=@q, rating_schedule=@s, rating_cost=@c, rating_safety=@sf, updated_at=datetime('now') WHERE id=@id`
    ).run({ q: avg.quality, s: avg.schedule_adherence, c: avg.cost, sf: avg.safety, id: partnerId });
    writeBizAudit(db, { entity_type: 'partner_evaluation', entity_id: created.id, action: 'create', before: null, after: created, actor: data.actor });
    return created;
  });
  return run();
}

/** إعادة احتساب أعمدة rating_* المخزَّنة لكل الشركاء ذوي تقييمات فعلية - أداة تصحيح لمرة واحدة
 *  لبيانات موجودة سابقاً (تقييمات أُدخلت قبل هذا الإصلاح ولم تُحدَّث بعد بسبب الخلل أعلاه). */
export function recomputeAllPartnerRatings() {
  const db = bdb();
  const run = db.transaction(() => {
    const ids = db.prepare(`SELECT DISTINCT partner_id AS id FROM biz_partner_evaluations`).all().map((r) => r.id);
    for (const id of ids) {
      const evals = db.prepare(`SELECT * FROM biz_partner_evaluations WHERE partner_id = ?`).all(id);
      const avg = computePartnerOverallRating(evals);
      if (!avg) continue;
      db.prepare(`UPDATE biz_partners SET rating_quality=@q, rating_schedule=@s, rating_cost=@c, rating_safety=@sf WHERE id=@id`)
        .run({ q: avg.quality, s: avg.schedule_adherence, c: avg.cost, sf: avg.safety, id });
    }
    return { updated: ids.length };
  });
  return run();
}

export function hardDeletePartner(id, actor) {
  const db = bdb();
  const run = db.transaction(() => {
    const before = getPartnerById(id);
    if (!before) return { deleted: false };
    const linked = db.prepare(`SELECT COUNT(*) AS n FROM biz_work_orders WHERE partner_id = ?`).get(id).n;
    if (linked > 0) throw new Error('لا يمكن حذف شريك مرتبط بأوامر عمل فعلية - استخدم تغيير الحالة إلى غير نشط بدلاً من ذلك.');
    writeBizAudit(db, { entity_type: 'partner', entity_id: id, action: 'hard_delete', before, after: null, actor });
    db.prepare(`DELETE FROM biz_partners WHERE id = ?`).run(id);
    return { deleted: true };
  });
  return run();
}
