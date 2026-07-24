// lib/pm/db/safety.js
import { randomUUID } from 'crypto';
import { pdb } from '../schema.js';
import { writePmAudit } from './audit.js';
import { upsertNotification } from './notifications.js';

const RECORD_TYPES = ['plan', 'incident', 'injury', 'inspection', 'permit', 'violation'];
const ALERT_TYPES = ['incident', 'injury', 'violation'];

export function listSafetyRecords({ project_id, record_type, status } = {}) {
  const db = pdb();
  let where = ' WHERE 1=1';
  const params = {};
  if (project_id) { where += ' AND project_id = @project_id'; params.project_id = project_id; }
  if (record_type) { where += ' AND record_type = @record_type'; params.record_type = record_type; }
  if (status) { where += ' AND status = @status'; params.status = status; }
  return db.prepare(`SELECT * FROM pm_safety_records${where} ORDER BY record_date DESC, created_at DESC`).all(params);
}

export function getSafetyRecord(id) {
  return pdb().prepare(`SELECT * FROM pm_safety_records WHERE id = ?`).get(id);
}

export function createSafetyRecord(data) {
  if (!RECORD_TYPES.includes(data.record_type)) throw new Error(`نوع سجل سلامة غير معروف: ${data.record_type}`);
  const db = pdb();
  const run = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO pm_safety_records (uuid, project_id, record_type, title, description, severity, responsible, record_date, corrective_action, status)
         VALUES (@uuid, @project_id, @record_type, @title, @description, @severity, @responsible, @record_date, @corrective_action, @status)`
      )
      .run({
        uuid: randomUUID(), project_id: data.project_id, record_type: data.record_type, title: data.title,
        description: data.description || null, severity: data.severity || 'low', responsible: data.responsible || null,
        record_date: data.record_date || null, corrective_action: data.corrective_action || null, status: data.status || 'open',
      });
    const created = getSafetyRecord(info.lastInsertRowid);
    writePmAudit(db, { project_id: created.project_id, entity_type: 'safety_record', entity_id: created.id, action: 'create', before: null, after: created, actor: data.actor });
    if (ALERT_TYPES.includes(data.record_type)) {
      upsertNotification({
        project_id: data.project_id, type: 'safety_violation', severity: data.severity === 'high' ? 'critical' : 'warning',
        title: `مخالفة/حادث سلامة: ${data.title}`,
        message: data.description || 'تسجيل حدث سلامة جديد يحتاج مراجعة فورية.',
        related_entity_type: 'safety_record', related_entity_id: created.id,
        dedup_key: `safety_violation:${created.id}`,
      });
    }
    return created;
  });
  return run();
}

export function updateSafetyRecord(id, data) {
  const db = pdb();
  const run = db.transaction(() => {
    const before = getSafetyRecord(id);
    if (!before) throw new Error('سجل السلامة غير موجود.');
    const merged = { ...before, ...data };
    db.prepare(
      `UPDATE pm_safety_records SET record_type=@record_type, title=@title, description=@description, severity=@severity,
         responsible=@responsible, record_date=@record_date, corrective_action=@corrective_action, status=@status, updated_at=datetime('now') WHERE id=@id`
    ).run({
      id, record_type: merged.record_type, title: merged.title, description: merged.description || null, severity: merged.severity,
      responsible: merged.responsible || null, record_date: merged.record_date || null, corrective_action: merged.corrective_action || null,
      status: merged.status,
    });
    const after = getSafetyRecord(id);
    writePmAudit(db, { project_id: after.project_id, entity_type: 'safety_record', entity_id: id, action: 'update', before, after, actor: data.actor });
    return after;
  });
  return run();
}

export function deleteSafetyRecord(id, actor) {
  const db = pdb();
  const run = db.transaction(() => {
    const before = getSafetyRecord(id);
    if (!before) return { deleted: false };
    db.prepare(`DELETE FROM pm_safety_records WHERE id = ?`).run(id);
    writePmAudit(db, { project_id: before.project_id, entity_type: 'safety_record', entity_id: id, action: 'delete', before, after: null, actor });
    return { deleted: true };
  });
  return run();
}
