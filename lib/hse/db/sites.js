// lib/hse/db/sites.js
// إدارة مواقع العمل (البند 2). عدد العاملين/عدد المعدات/آخر تفتيش/مستوى الخطورة كلها قيم
// محسوبة حيّة (JOIN حقيقي وقت الطلب) لا أعمدة مخزَّنة يمكن أن تصبح قديمة - بدل تكرار بيانات
// موجودة أصلاً في pm_team_members/equipment_assets/hse_inspections/hse_risks (البند 25:
// "منع تكرار البيانات"، ونفس أسلوب lib/pm/db/projectStats.js).
import { randomUUID } from 'crypto';
import { hdb } from '../schema.js';
import { writeHseAudit } from './audit.js';
import { ValidationError } from '../../calc/common.js';

function validateSite(data) {
  const errors = [];
  if (!data.project_id) errors.push('المشروع مطلوب.');
  if (!data.name || !data.name.trim()) errors.push('اسم الموقع مطلوب.');
  if (errors.length) throw new ValidationError(errors);
}

export function createSite(data, actor) {
  validateSite(data);
  const db = hdb();
  const run = db.transaction(() => {
    const uuid = randomUUID();
    const info = db.prepare(
      `INSERT INTO hse_sites (uuid, project_id, name, location, operational_zones, current_activities, key_hazards, safety_officer, site_status, notes)
       VALUES (@uuid, @project_id, @name, @location, @operational_zones, @current_activities, @key_hazards, @safety_officer, @site_status, @notes)`
    ).run({
      uuid, project_id: data.project_id, name: data.name.trim(), location: data.location || null,
      operational_zones: data.operational_zones || null, current_activities: data.current_activities || null,
      key_hazards: data.key_hazards || null, safety_officer: data.safety_officer || null,
      site_status: data.site_status || 'active', notes: data.notes || null,
    });
    const created = getSiteById(info.lastInsertRowid);
    writeHseAudit(db, { project_id: data.project_id, entity_type: 'site', entity_id: created.id, action: 'create', before: null, after: created, actor });
    return created;
  });
  return run();
}

export function getSiteById(id) {
  return hdb().prepare(`SELECT * FROM hse_sites WHERE id = ?`).get(id);
}

/** يُعيد الموقع مع إحصاءات حية حقيقية (استعلامات JOIN فعلية، وليست أعمدة مخزَّنة). */
export function getSiteWithStats(id) {
  const db = hdb();
  const site = getSiteById(id);
  if (!site) return null;
  const workforce_count = db.prepare(`SELECT COUNT(*) AS c FROM pm_team_members WHERE project_id = ? AND is_active = 1`).get(site.project_id).c;
  const equipment_count = db.prepare(`SELECT COUNT(*) AS c FROM equipment_assets WHERE current_project_id = ? AND is_archived = 0`).get(site.project_id).c;
  const lastInspection = db.prepare(`SELECT inspection_date FROM hse_inspections WHERE site_id = ? ORDER BY inspection_date DESC LIMIT 1`).get(id);
  const topRisk = db.prepare(
    `SELECT risk_level FROM hse_risks WHERE site_id = ? AND status != 'closed'
     ORDER BY CASE risk_level WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END DESC LIMIT 1`
  ).get(id);
  return {
    ...site,
    workforce_count,
    equipment_count,
    last_inspection_date: lastInspection?.inspection_date || null,
    risk_level: topRisk?.risk_level || null,
  };
}

export function listSites({ project_id, site_status, page = 1, pageSize = 20 } = {}) {
  const db = hdb();
  let where = ' WHERE 1=1';
  const params = {};
  if (project_id) { where += ' AND project_id = @project_id'; params.project_id = project_id; }
  if (site_status) { where += ' AND site_status = @site_status'; params.site_status = site_status; }
  const total = db.prepare(`SELECT COUNT(*) AS c FROM hse_sites${where}`).get(params).c;
  const offset = (page - 1) * pageSize;
  const rows = db.prepare(`SELECT * FROM hse_sites${where} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`).all({ ...params, limit: pageSize, offset });
  return { rows: rows.map((s) => getSiteWithStats(s.id)), total, page, pageSize };
}

export function updateSite(id, data, actor) {
  const db = hdb();
  const run = db.transaction(() => {
    const before = getSiteById(id);
    if (!before) throw new ValidationError('الموقع غير موجود.');
    const merged = { ...before, ...data };
    validateSite(merged);
    db.prepare(
      `UPDATE hse_sites SET name=@name, location=@location, operational_zones=@operational_zones,
         current_activities=@current_activities, key_hazards=@key_hazards, safety_officer=@safety_officer,
         site_status=@site_status, notes=@notes, updated_at=datetime('now') WHERE id=@id`
    ).run({ id, name: merged.name, location: merged.location, operational_zones: merged.operational_zones,
      current_activities: merged.current_activities, key_hazards: merged.key_hazards,
      safety_officer: merged.safety_officer, site_status: merged.site_status, notes: merged.notes });
    const after = getSiteById(id);
    writeHseAudit(db, { project_id: after.project_id, entity_type: 'site', entity_id: id, action: 'update', before, after, actor });
    return after;
  });
  return run();
}

export function deleteSite(id, actor) {
  const db = hdb();
  const run = db.transaction(() => {
    const before = getSiteById(id);
    if (!before) return { deleted: false };
    db.prepare(`DELETE FROM hse_sites WHERE id = ?`).run(id);
    writeHseAudit(db, { project_id: before.project_id, entity_type: 'site', entity_id: id, action: 'delete', before, after: null, actor });
    return { deleted: true };
  });
  return run();
}
