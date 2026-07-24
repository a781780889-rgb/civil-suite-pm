// lib/pm/db/phases.js
import { randomUUID } from 'crypto';
import { pdb } from '../schema.js';
import { writePmAudit } from './audit.js';

export function listPhases(projectId) {
  return pdb().prepare(`SELECT * FROM pm_phases WHERE project_id = ? ORDER BY sequence ASC, created_at ASC`).all(projectId);
}

export function getPhase(id) {
  return pdb().prepare(`SELECT * FROM pm_phases WHERE id = ?`).get(id);
}

export function createPhase(data) {
  const db = pdb();
  const run = db.transaction(() => {
    const maxSeq = db.prepare(`SELECT COALESCE(MAX(sequence), -1) AS m FROM pm_phases WHERE project_id = ?`).get(data.project_id).m;
    const info = db
      .prepare(
        `INSERT INTO pm_phases (uuid, project_id, name, sequence, planned_start, planned_end, actual_start, actual_end, responsible, status, progress_pct, notes)
         VALUES (@uuid, @project_id, @name, @sequence, @planned_start, @planned_end, @actual_start, @actual_end, @responsible, @status, @progress_pct, @notes)`
      )
      .run({
        uuid: randomUUID(),
        project_id: data.project_id,
        name: data.name,
        sequence: data.sequence ?? maxSeq + 1,
        planned_start: data.planned_start || null,
        planned_end: data.planned_end || null,
        actual_start: data.actual_start || null,
        actual_end: data.actual_end || null,
        responsible: data.responsible || null,
        status: data.status || 'not_started',
        progress_pct: data.progress_pct || 0,
        notes: data.notes || null,
      });
    const created = getPhase(info.lastInsertRowid);
    writePmAudit(db, { project_id: data.project_id, entity_type: 'phase', entity_id: created.id, action: 'create', before: null, after: created, actor: data.actor });
    return created;
  });
  return run();
}

export function updatePhase(id, data) {
  const db = pdb();
  const run = db.transaction(() => {
    const before = getPhase(id);
    if (!before) throw new Error('المرحلة غير موجودة.');
    const merged = { ...before, ...data };
    db.prepare(
      `UPDATE pm_phases SET name=@name, sequence=@sequence, planned_start=@planned_start, planned_end=@planned_end,
         actual_start=@actual_start, actual_end=@actual_end, responsible=@responsible, status=@status,
         progress_pct=@progress_pct, notes=@notes, updated_at=datetime('now') WHERE id=@id`
    ).run({
      id, name: merged.name, sequence: merged.sequence, planned_start: merged.planned_start || null,
      planned_end: merged.planned_end || null, actual_start: merged.actual_start || null, actual_end: merged.actual_end || null,
      responsible: merged.responsible || null, status: merged.status, progress_pct: merged.progress_pct || 0, notes: merged.notes || null,
    });
    const after = getPhase(id);
    writePmAudit(db, { project_id: after.project_id, entity_type: 'phase', entity_id: id, action: 'update', before, after, actor: data.actor });
    return after;
  });
  return run();
}

/** يُحدِّث نسبة إنجاز المرحلة المحسوبة تلقائياً من مهامها - يُستدعى بعد أي تعديل على مهمة. */
export function setPhaseComputedProgress(id, progressPct) {
  const db = pdb();
  db.prepare(`UPDATE pm_phases SET progress_pct = ?, updated_at = datetime('now') WHERE id = ?`).run(progressPct, id);
}

export function deletePhase(id, actor) {
  const db = pdb();
  const run = db.transaction(() => {
    const before = getPhase(id);
    if (!before) return { deleted: false };
    db.prepare(`UPDATE pm_tasks SET phase_id = NULL WHERE phase_id = ?`).run(id); // المهام تبقى بلا حذف - تُفصل عن المرحلة فقط
    db.prepare(`DELETE FROM pm_phases WHERE id = ?`).run(id);
    writePmAudit(db, { project_id: before.project_id, entity_type: 'phase', entity_id: id, action: 'delete', before, after: null, actor });
    return { deleted: true };
  });
  return run();
}

export function reorderPhases(projectId, orderedIds) {
  const db = pdb();
  const run = db.transaction(() => {
    orderedIds.forEach((id, idx) => {
      db.prepare(`UPDATE pm_phases SET sequence = ? WHERE id = ? AND project_id = ?`).run(idx, id, projectId);
    });
    return listPhases(projectId);
  });
  return run();
}
