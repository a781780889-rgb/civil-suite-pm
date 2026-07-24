// lib/pm/db/quality.js
import { randomUUID } from 'crypto';
import { pdb } from '../schema.js';
import { writePmAudit } from './audit.js';
import { upsertNotification } from './notifications.js';

const RECORD_TYPES = ['plan', 'inspection', 'material_test', 'approval', 'rejection', 'corrective_action'];

export function listQualityRecords({ project_id, record_type, status } = {}) {
  const db = pdb();
  let where = ' WHERE 1=1';
  const params = {};
  if (project_id) { where += ' AND project_id = @project_id'; params.project_id = project_id; }
  if (record_type) { where += ' AND record_type = @record_type'; params.record_type = record_type; }
  if (status) { where += ' AND status = @status'; params.status = status; }
  return db.prepare(`SELECT * FROM pm_quality_records${where} ORDER BY record_date DESC, created_at DESC`).all(params);
}

export function getQualityRecord(id) {
  return pdb().prepare(`SELECT * FROM pm_quality_records WHERE id = ?`).get(id);
}

export function createQualityRecord(data) {
  if (!RECORD_TYPES.includes(data.record_type)) throw new Error(`نوع سجل جودة غير معروف: ${data.record_type}`);
  const db = pdb();
  const run = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO pm_quality_records (uuid, project_id, record_type, title, description, result, related_task_id, responsible, record_date, status, corrective_action)
         VALUES (@uuid, @project_id, @record_type, @title, @description, @result, @related_task_id, @responsible, @record_date, @status, @corrective_action)`
      )
      .run({
        uuid: randomUUID(), project_id: data.project_id, record_type: data.record_type, title: data.title,
        description: data.description || null, result: data.result || null, related_task_id: data.related_task_id || null,
        responsible: data.responsible || null, record_date: data.record_date || null, status: data.status || 'open',
        corrective_action: data.corrective_action || null,
      });
    const created = getQualityRecord(info.lastInsertRowid);
    writePmAudit(db, { project_id: created.project_id, entity_type: 'quality_record', entity_id: created.id, action: 'create', before: null, after: created, actor: data.actor });
    if (data.record_type === 'rejection') {
      upsertNotification({
        project_id: data.project_id, type: 'quality_issue', severity: 'warning',
        title: `مشكلة جودة: ${data.title}`,
        message: data.description || 'تسجيل حالة رفض جودة جديدة تحتاج مراجعة.',
        related_entity_type: 'quality_record', related_entity_id: created.id,
        dedup_key: `quality_issue:${created.id}`,
      });
    }
    return created;
  });
  return run();
}

export function updateQualityRecord(id, data) {
  const db = pdb();
  const run = db.transaction(() => {
    const before = getQualityRecord(id);
    if (!before) throw new Error('سجل الجودة غير موجود.');
    const merged = { ...before, ...data };
    db.prepare(
      `UPDATE pm_quality_records SET record_type=@record_type, title=@title, description=@description, result=@result,
         related_task_id=@related_task_id, responsible=@responsible, record_date=@record_date, status=@status,
         corrective_action=@corrective_action, updated_at=datetime('now') WHERE id=@id`
    ).run({
      id, record_type: merged.record_type, title: merged.title, description: merged.description || null, result: merged.result || null,
      related_task_id: merged.related_task_id || null, responsible: merged.responsible || null, record_date: merged.record_date || null,
      status: merged.status, corrective_action: merged.corrective_action || null,
    });
    const after = getQualityRecord(id);
    writePmAudit(db, { project_id: after.project_id, entity_type: 'quality_record', entity_id: id, action: 'update', before, after, actor: data.actor });
    return after;
  });
  return run();
}

export function deleteQualityRecord(id, actor) {
  const db = pdb();
  const run = db.transaction(() => {
    const before = getQualityRecord(id);
    if (!before) return { deleted: false };
    db.prepare(`DELETE FROM pm_quality_records WHERE id = ?`).run(id);
    writePmAudit(db, { project_id: before.project_id, entity_type: 'quality_record', entity_id: id, action: 'delete', before, after: null, actor });
    return { deleted: true };
  });
  return run();
}
