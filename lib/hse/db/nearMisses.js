// lib/hse/db/nearMisses.js
// البلاغات القريبة من الحوادث Near Miss (البند 8) - مع "ربطها بتحليل المخاطر" حرفياً عبر
// linked_risk_id الاختياري (يشير لسجل موجود فعلاً في hse_risks، يُتحقق من وجوده عند الربط).
import { randomUUID } from 'crypto';
import { hdb } from '../schema.js';
import { writeHseAudit } from './audit.js';
import { ValidationError } from '../../calc/common.js';

function validateNearMiss(data) {
  const errors = [];
  if (!data.project_id) errors.push('المشروع مطلوب.');
  if (!data.description || !data.description.trim()) errors.push('وصف الحالة مطلوب.');
  if (errors.length) throw new ValidationError(errors);
}

export function createNearMiss(data, actor) {
  validateNearMiss(data);
  const db = hdb();
  const run = db.transaction(() => {
    if (data.linked_risk_id) {
      const risk = db.prepare(`SELECT id FROM hse_risks WHERE id = ?`).get(data.linked_risk_id);
      if (!risk) throw new ValidationError('الخطر المرتبط غير موجود.');
    }
    const uuid = randomUUID();
    const info = db.prepare(
      `INSERT INTO hse_near_misses (uuid, near_miss_no, project_id, site_id, description, location, activity, risk_level, cause, preventive_actions, responsible, linked_risk_id, reported_by)
       VALUES (@uuid, 'TEMP', @project_id, @site_id, @description, @location, @activity, @risk_level, @cause, @preventive_actions, @responsible, @linked_risk_id, @reported_by)`
    ).run({
      uuid, project_id: data.project_id, site_id: data.site_id || null, description: data.description.trim(),
      location: data.location || null, activity: data.activity || null, risk_level: data.risk_level || 'low',
      cause: data.cause || null, preventive_actions: data.preventive_actions || null, responsible: data.responsible || null,
      linked_risk_id: data.linked_risk_id || null, reported_by: data.reported_by || actor || null,
    });
    const id = info.lastInsertRowid;
    db.prepare(`UPDATE hse_near_misses SET near_miss_no = ? WHERE id = ?`).run(`NM-${String(id).padStart(5, '0')}`, id);
    const created = getNearMissById(id);
    writeHseAudit(db, { project_id: data.project_id, entity_type: 'near_miss', entity_id: id, action: 'create', before: null, after: created, actor });
    return created;
  });
  return run();
}

export function getNearMissById(id) {
  return hdb().prepare(`SELECT * FROM hse_near_misses WHERE id = ?`).get(id);
}

export function listNearMisses({ project_id, site_id, status, page = 1, pageSize = 20 } = {}) {
  const db = hdb();
  let where = ' WHERE 1=1';
  const params = {};
  if (project_id) { where += ' AND project_id = @project_id'; params.project_id = project_id; }
  if (site_id) { where += ' AND site_id = @site_id'; params.site_id = site_id; }
  if (status) { where += ' AND status = @status'; params.status = status; }
  const total = db.prepare(`SELECT COUNT(*) AS c FROM hse_near_misses${where}`).get(params).c;
  const offset = (page - 1) * pageSize;
  const rows = db.prepare(`SELECT * FROM hse_near_misses${where} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`).all({ ...params, limit: pageSize, offset });
  return { rows, total, page, pageSize };
}

export function updateNearMiss(id, data, actor) {
  const db = hdb();
  const run = db.transaction(() => {
    const before = getNearMissById(id);
    if (!before) throw new ValidationError('البلاغ غير موجود.');
    const merged = { ...before, ...data };
    validateNearMiss(merged);
    db.prepare(
      `UPDATE hse_near_misses SET description=@description, location=@location, activity=@activity, risk_level=@risk_level,
         cause=@cause, preventive_actions=@preventive_actions, responsible=@responsible, linked_risk_id=@linked_risk_id,
         updated_at=datetime('now') WHERE id=@id`
    ).run({ id, description: merged.description, location: merged.location, activity: merged.activity,
      risk_level: merged.risk_level, cause: merged.cause, preventive_actions: merged.preventive_actions,
      responsible: merged.responsible, linked_risk_id: merged.linked_risk_id || null });
    const after = getNearMissById(id);
    writeHseAudit(db, { project_id: after.project_id, entity_type: 'near_miss', entity_id: id, action: 'update', before, after, actor });
    return after;
  });
  return run();
}

export function closeNearMiss(id, actor) {
  const db = hdb();
  const run = db.transaction(() => {
    const before = getNearMissById(id);
    if (!before) throw new ValidationError('البلاغ غير موجود.');
    db.prepare(`UPDATE hse_near_misses SET status='closed', updated_at=datetime('now') WHERE id=?`).run(id);
    const after = getNearMissById(id);
    writeHseAudit(db, { project_id: after.project_id, entity_type: 'near_miss', entity_id: id, action: 'close', before, after, actor });
    return after;
  });
  return run();
}
