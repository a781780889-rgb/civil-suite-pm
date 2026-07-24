// lib/pm/db/projects.js
// =============================================================================
// إدارة المشاريع (قاعدة ثانياً وثالثاً الإلزاميتان). يوسّع جدول projects الموجود (لا يستبدله)
// - كل مشروع يُنشأ هنا يبقى متاحاً لأدوات الأقسام 1-3 (حاسبة الخرسانة/الحديد/BOQ) عبر project_id
// كما هي العلاقة أصلاً، محققاً "ربط جميع أقسام النظام" دون أي تكرار للبيانات.
// =============================================================================

import { pdb } from '../schema.js';
import { writePmAudit } from './audit.js';
import { PROJECT_STATUSES } from '../schema.js';
import { upsertNotification } from './notifications.js';

const FULL_FIELDS = [
  'name', 'project_code', 'project_type', 'description',
  'owner_name', 'contractor_name', 'subcontractor_name', 'consultant_name',
  'project_manager_name', 'engineer_name', 'client_name',
  'location', 'latitude', 'longitude', 'city', 'country',
  'start_date', 'end_date', 'contract_value', 'budget', 'target_profit_pct', 'currency',
  'status', 'priority', 'cover_image_base64', 'logo_base64',
];

function normalize(data) {
  const out = {};
  for (const f of FULL_FIELDS) out[f] = data[f] !== undefined ? data[f] : null;
  out.name = out.name || 'مشروع بدون اسم';
  out.currency = out.currency || 'SAR';
  out.status = PROJECT_STATUSES.includes(out.status) ? out.status : 'planning';
  out.priority = out.priority || 'medium';
  out.contract_value = Number(out.contract_value) || 0;
  out.budget = Number(out.budget) || 0;
  out.target_profit_pct = Number(out.target_profit_pct) || 0;
  out.latitude = out.latitude === null || out.latitude === '' ? null : Number(out.latitude);
  out.longitude = out.longitude === null || out.longitude === '' ? null : Number(out.longitude);
  return out;
}

export function findDuplicateProjectCode(code, excludeId) {
  if (!code) return null;
  const db = pdb();
  const row = excludeId
    ? db.prepare(`SELECT * FROM projects WHERE project_code = @code AND id != @id`).get({ code, id: excludeId })
    : db.prepare(`SELECT * FROM projects WHERE project_code = @code`).get({ code });
  return row || null;
}

export function createProjectFull(data) {
  const db = pdb();
  const run = db.transaction(() => {
    const n = normalize(data);
    const info = db
      .prepare(
        `INSERT INTO projects (${FULL_FIELDS.join(', ')})
         VALUES (${FULL_FIELDS.map((f) => '@' + f).join(', ')})`
      )
      .run(n);
    const created = getProjectById(info.lastInsertRowid);
    writePmAudit(db, { project_id: created.id, entity_type: 'project', entity_id: created.id, action: 'create', before: null, after: created, actor: data.actor });
    db.prepare(`INSERT INTO pm_project_status_log (project_id, old_status, new_status, note, actor) VALUES (?, NULL, ?, 'إنشاء المشروع', ?)`)
      .run(created.id, created.status, data.actor || null);
    return created;
  });
  return run();
}

export function updateProjectFull(id, data) {
  const db = pdb();
  const run = db.transaction(() => {
    const before = getProjectById(id);
    if (!before) throw new Error('المشروع غير موجود.');
    const merged = { ...before, ...data };
    const n = normalize(merged);
    db.prepare(
      `UPDATE projects SET ${FULL_FIELDS.map((f) => `${f}=@${f}`).join(', ')}, updated_at = datetime('now') WHERE id = @id`
    ).run({ ...n, id });
    const after = getProjectById(id);
    writePmAudit(db, { project_id: id, entity_type: 'project', entity_id: id, action: 'update', before, after, actor: data.actor });
    return after;
  });
  return run();
}

export function getProjectById(id) {
  return pdb().prepare(`SELECT * FROM projects WHERE id = ?`).get(id);
}

export function listProjectsPaged({ status, priority, search, is_archived, page = 1, pageSize = 30 } = {}) {
  const db = pdb();
  let where = ' WHERE 1=1';
  const params = {};
  if (status) { where += ' AND status = @status'; params.status = status; }
  if (priority) { where += ' AND priority = @priority'; params.priority = priority; }
  if (search) { where += ' AND (name LIKE @search OR project_code LIKE @search OR client_name LIKE @search)'; params.search = `%${search}%`; }
  where += is_archived ? ' AND is_archived = 1' : ' AND is_archived = 0';

  const total = db.prepare(`SELECT COUNT(*) AS n FROM projects${where}`).get(params).n;
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(200, Math.max(1, Number(pageSize) || 30));
  const rows = db
    .prepare(`SELECT * FROM projects${where} ORDER BY updated_at DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: safePageSize, offset: (safePage - 1) * safePageSize });
  return { rows, total, page: safePage, pageSize: safePageSize, totalPages: Math.max(1, Math.ceil(total / safePageSize)) };
}

export function changeProjectStatus(id, newStatus, { note, actor } = {}) {
  if (!PROJECT_STATUSES.includes(newStatus)) throw new Error(`حالة مشروع غير معروفة: ${newStatus}`);
  const db = pdb();
  const run = db.transaction(() => {
    const before = getProjectById(id);
    if (!before) throw new Error('المشروع غير موجود.');
    db.prepare(`UPDATE projects SET status = @status, updated_at = datetime('now') WHERE id = @id`).run({ id, status: newStatus });
    db.prepare(`INSERT INTO pm_project_status_log (project_id, old_status, new_status, note, actor) VALUES (@id, @old, @new, @note, @actor)`)
      .run({ id, old: before.status, new: newStatus, note: note || null, actor: actor || null });
    const after = getProjectById(id);
    writePmAudit(db, { project_id: id, entity_type: 'project_status', entity_id: id, action: 'status_change', before: { status: before.status }, after: { status: newStatus }, actor });
    upsertNotification({
      project_id: id, type: 'status_changed', severity: 'info',
      title: 'تحديث حالة المشروع',
      message: `تغيّرت حالة المشروع من "${before.status}" إلى "${newStatus}".${note ? ' ملاحظة: ' + note : ''}`,
      related_entity_type: 'project', related_entity_id: id,
      dedup_key: `status_changed:${id}:${newStatus}:${Date.now()}`,
    });
    return after;
  });
  return run();
}

export function setProjectArchived(id, archived, actor) {
  const db = pdb();
  const run = db.transaction(() => {
    const before = getProjectById(id);
    if (!before) throw new Error('المشروع غير موجود.');
    db.prepare(`UPDATE projects SET is_archived = @v, updated_at = datetime('now') WHERE id = @id`).run({ id, v: archived ? 1 : 0 });
    writePmAudit(db, { project_id: id, entity_type: 'project', entity_id: id, action: archived ? 'archive' : 'unarchive', before, after: getProjectById(id), actor });
    return getProjectById(id);
  });
  return run();
}

/** حذف نهائي فعلي - يُستدعى فقط بعد فحص صلاحية خاصة إضافية في مسار الـ API (system_admin حصراً). */
export function hardDeleteProject(id, actor) {
  const db = pdb();
  const run = db.transaction(() => {
    const before = getProjectById(id);
    if (!before) return { deleted: false };
    writePmAudit(db, { project_id: id, entity_type: 'project', entity_id: id, action: 'hard_delete', before, after: null, actor });
    db.prepare(`DELETE FROM projects WHERE id = ?`).run(id);
    return { deleted: true };
  });
  return run();
}

export function listProjectStatusHistory(id) {
  return pdb().prepare(`SELECT * FROM pm_project_status_log WHERE project_id = ? ORDER BY created_at DESC`).all(id);
}
