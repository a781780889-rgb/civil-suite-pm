// lib/pm/db/risks.js
import { randomUUID } from 'crypto';
import { pdb } from '../schema.js';
import { writePmAudit } from './audit.js';
import { upsertNotification } from './notifications.js';

export function listRisks({ project_id, status } = {}) {
  const db = pdb();
  let where = ' WHERE 1=1';
  const params = {};
  if (project_id) { where += ' AND project_id = @project_id'; params.project_id = project_id; }
  if (status) { where += ' AND status = @status'; params.status = status; }
  const rows = db.prepare(`SELECT * FROM pm_risks${where} ORDER BY (probability * impact) DESC, updated_at DESC`).all(params);
  return rows.map((r) => ({ ...r, severityScore: r.probability * r.impact }));
}

export function getRisk(id) {
  const r = pdb().prepare(`SELECT * FROM pm_risks WHERE id = ?`).get(id);
  return r ? { ...r, severityScore: r.probability * r.impact } : null;
}

export function createRisk(data) {
  const db = pdb();
  const run = db.transaction(() => {
    const probability = Math.max(1, Math.min(5, Number(data.probability) || 3));
    const impact = Math.max(1, Math.min(5, Number(data.impact) || 3));
    const info = db
      .prepare(
        `INSERT INTO pm_risks (uuid, project_id, title, description, cause, category, probability, impact, owner, mitigation_plan, status, review_date)
         VALUES (@uuid, @project_id, @title, @description, @cause, @category, @probability, @impact, @owner, @mitigation_plan, @status, @review_date)`
      )
      .run({
        uuid: randomUUID(), project_id: data.project_id, title: data.title, description: data.description || null,
        cause: data.cause || null, category: data.category || null, probability, impact,
        owner: data.owner || null, mitigation_plan: data.mitigation_plan || null, status: data.status || 'open',
        review_date: data.review_date || null,
      });
    const created = getRisk(info.lastInsertRowid);
    writePmAudit(db, { project_id: created.project_id, entity_type: 'risk', entity_id: created.id, action: 'create', before: null, after: created, actor: data.actor });
    if (probability * impact >= 15) {
      upsertNotification({
        project_id: data.project_id, type: 'high_risk', severity: 'critical',
        title: `خطر عالي الخطورة: ${data.title}`,
        message: `درجة الخطورة ${probability * impact}/25 (احتمالية ${probability} × تأثير ${impact}).`,
        related_entity_type: 'risk', related_entity_id: created.id,
        dedup_key: `high_risk:${created.id}`,
      });
    }
    return created;
  });
  return run();
}

export function updateRisk(id, data) {
  const db = pdb();
  const run = db.transaction(() => {
    const before = getRisk(id);
    if (!before) throw new Error('الخطر غير موجود.');
    const merged = { ...before, ...data };
    const probability = Math.max(1, Math.min(5, Number(merged.probability) || 3));
    const impact = Math.max(1, Math.min(5, Number(merged.impact) || 3));
    db.prepare(
      `UPDATE pm_risks SET title=@title, description=@description, cause=@cause, category=@category, probability=@probability,
         impact=@impact, owner=@owner, mitigation_plan=@mitigation_plan, status=@status, review_date=@review_date, updated_at=datetime('now') WHERE id=@id`
    ).run({
      id, title: merged.title, description: merged.description || null, cause: merged.cause || null, category: merged.category || null,
      probability, impact, owner: merged.owner || null, mitigation_plan: merged.mitigation_plan || null, status: merged.status,
      review_date: merged.review_date || null,
    });
    const after = getRisk(id);
    writePmAudit(db, { project_id: after.project_id, entity_type: 'risk', entity_id: id, action: 'update', before, after, actor: data.actor });
    return after;
  });
  return run();
}

export function deleteRisk(id, actor) {
  const db = pdb();
  const run = db.transaction(() => {
    const before = getRisk(id);
    if (!before) return { deleted: false };
    db.prepare(`DELETE FROM pm_risks WHERE id = ?`).run(id);
    writePmAudit(db, { project_id: before.project_id, entity_type: 'risk', entity_id: id, action: 'delete', before, after: null, actor });
    return { deleted: true };
  });
  return run();
}
