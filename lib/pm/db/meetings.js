// lib/pm/db/meetings.js
import { randomUUID } from 'crypto';
import { pdb } from '../schema.js';
import { writePmAudit } from './audit.js';
import { createTask } from './tasks.js';

export function listMeetings({ project_id } = {}) {
  const db = pdb();
  const rows = project_id
    ? db.prepare(`SELECT * FROM pm_meetings WHERE project_id = ? ORDER BY meeting_date DESC`).all(project_id)
    : db.prepare(`SELECT * FROM pm_meetings ORDER BY meeting_date DESC`).all();
  return rows.map((r) => ({ ...r, attendees: JSON.parse(r.attendees_json || '[]') }));
}

export function getMeeting(id) {
  const r = pdb().prepare(`SELECT * FROM pm_meetings WHERE id = ?`).get(id);
  return r ? { ...r, attendees: JSON.parse(r.attendees_json || '[]') } : null;
}

export function createMeeting(data) {
  const db = pdb();
  const run = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO pm_meetings (uuid, project_id, title, meeting_date, location, attendees_json, agenda, minutes, created_by)
         VALUES (@uuid, @project_id, @title, @meeting_date, @location, @attendees_json, @agenda, @minutes, @created_by)`
      )
      .run({
        uuid: randomUUID(), project_id: data.project_id, title: data.title, meeting_date: data.meeting_date || null,
        location: data.location || null, attendees_json: JSON.stringify(data.attendees || []),
        agenda: data.agenda || null, minutes: data.minutes || null, created_by: data.actor || null,
      });
    const created = getMeeting(info.lastInsertRowid);
    writePmAudit(db, { project_id: created.project_id, entity_type: 'meeting', entity_id: created.id, action: 'create', before: null, after: created, actor: data.actor });
    return created;
  });
  return run();
}

export function updateMeeting(id, data) {
  const db = pdb();
  const run = db.transaction(() => {
    const before = getMeeting(id);
    if (!before) throw new Error('الاجتماع غير موجود.');
    const merged = { ...before, ...data };
    db.prepare(
      `UPDATE pm_meetings SET title=@title, meeting_date=@meeting_date, location=@location, attendees_json=@attendees_json,
         agenda=@agenda, minutes=@minutes, updated_at=datetime('now') WHERE id=@id`
    ).run({
      id, title: merged.title, meeting_date: merged.meeting_date || null, location: merged.location || null,
      attendees_json: JSON.stringify(merged.attendees || []), agenda: merged.agenda || null, minutes: merged.minutes || null,
    });
    const after = getMeeting(id);
    writePmAudit(db, { project_id: after.project_id, entity_type: 'meeting', entity_id: id, action: 'update', before, after, actor: data.actor });
    return after;
  });
  return run();
}

export function deleteMeeting(id, actor) {
  const db = pdb();
  const run = db.transaction(() => {
    const before = getMeeting(id);
    if (!before) return { deleted: false };
    db.prepare(`DELETE FROM pm_meetings WHERE id = ?`).run(id);
    writePmAudit(db, { project_id: before.project_id, entity_type: 'meeting', entity_id: id, action: 'delete', before, after: null, actor });
    return { deleted: true };
  });
  return run();
}

// ---------- القرارات ----------

export function listDecisions(meetingId) {
  return pdb().prepare(`SELECT * FROM pm_meeting_decisions WHERE meeting_id = ? ORDER BY created_at ASC`).all(meetingId);
}

/** يُضيف قراراً، ويُنشئ مهمة فعلية مرتبطة به تلقائياً إن طُلب ذلك (generateTask=true) - ربط حقيقي عبر generated_task_id. */
export function addDecision({ meeting_id, decision_text, responsible, due_date, generateTask, project_id, actor }) {
  const db = pdb();
  const run = db.transaction(() => {
    let generatedTaskId = null;
    if (generateTask && project_id) {
      const task = createTask({
        project_id, title: decision_text.slice(0, 200), description: `مهمة ناتجة عن قرار اجتماع رقم ${meeting_id}.`,
        planned_start: due_date || null, planned_end: due_date || null, status: 'not_started', actor,
      });
      generatedTaskId = task.id;
    }
    const info = db
      .prepare(
        `INSERT INTO pm_meeting_decisions (meeting_id, decision_text, responsible, due_date, generated_task_id, status)
         VALUES (@meeting_id, @decision_text, @responsible, @due_date, @generated_task_id, 'open')`
      )
      .run({ meeting_id, decision_text, responsible: responsible || null, due_date: due_date || null, generated_task_id: generatedTaskId });
    const created = db.prepare(`SELECT * FROM pm_meeting_decisions WHERE id = ?`).get(info.lastInsertRowid);
    writePmAudit(db, { project_id, entity_type: 'meeting_decision', entity_id: created.id, action: 'create', before: null, after: created, actor });
    return created;
  });
  return run();
}

export function updateDecisionStatus(id, status) {
  pdb().prepare(`UPDATE pm_meeting_decisions SET status = ? WHERE id = ?`).run(status, id);
  return pdb().prepare(`SELECT * FROM pm_meeting_decisions WHERE id = ?`).get(id);
}

export function deleteDecision(id) {
  const info = pdb().prepare(`DELETE FROM pm_meeting_decisions WHERE id = ?`).run(id);
  return { deleted: info.changes > 0 };
}
