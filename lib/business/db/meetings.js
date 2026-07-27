// lib/business/db/meetings.js — إدارة الاجتماعات، البند الثاني عشر من القواعد الإلزامية.
// "يجب ربط المهام الناتجة مباشرة بقسم إدارة المشاريع والجدول الزمني" - addDecision تُنشئ فعلياً
// pm_task حقيقية عبر lib/pm/db/tasks.js عندما يكون الاجتماع مرتبطاً بمشروع (project_id)، بدل
// نص "مهمة" منفصل غير متصل بشيء - تكامل حقيقي بالبند 16.
import { randomUUID } from 'crypto';
import { bdb } from '../schema.js';
import { writeBizAudit } from './audit.js';
import { createTask } from '../../pm/db/tasks.js';

export function createMeeting(data) {
  const db = bdb();
  const run = db.transaction(() => {
    if (!data.title) throw new Error('عنوان الاجتماع مطلوب.');
    const uuid = randomUUID();
    const info = db
      .prepare(
        `INSERT INTO biz_meetings (uuid, title, meeting_date, location, client_id, opportunity_id, contract_id, project_id, attendees_json, agenda, minutes, created_by)
         VALUES (@uuid, @title, @meeting_date, @location, @client_id, @opportunity_id, @contract_id, @project_id, @attendees_json, @agenda, @minutes, @created_by)`
      )
      .run({
        uuid, title: data.title, meeting_date: data.meeting_date || null, location: data.location || null,
        client_id: data.client_id || null, opportunity_id: data.opportunity_id || null, contract_id: data.contract_id || null,
        project_id: data.project_id || null, attendees_json: JSON.stringify(data.attendees || []),
        agenda: data.agenda || null, minutes: data.minutes || null, created_by: data.actor || null,
      });
    const created = getMeetingById(info.lastInsertRowid);
    writeBizAudit(db, { entity_type: 'meeting', entity_id: created.id, action: 'create', before: null, after: created, actor: data.actor });
    return created;
  });
  return run();
}

export function updateMeeting(id, data) {
  const db = bdb();
  const run = db.transaction(() => {
    const before = getMeetingById(id);
    if (!before) throw new Error('الاجتماع غير موجود.');
    const merged = { ...before, ...data };
    db.prepare(
      `UPDATE biz_meetings SET title=@title, meeting_date=@meeting_date, location=@location, client_id=@client_id,
         opportunity_id=@opportunity_id, contract_id=@contract_id, project_id=@project_id, attendees_json=@attendees_json,
         agenda=@agenda, minutes=@minutes, updated_at=datetime('now') WHERE id=@id`
    ).run({
      id, title: merged.title, meeting_date: merged.meeting_date || null, location: merged.location || null,
      client_id: merged.client_id || null, opportunity_id: merged.opportunity_id || null, contract_id: merged.contract_id || null,
      project_id: merged.project_id || null,
      attendees_json: JSON.stringify(data.attendees !== undefined ? data.attendees : JSON.parse(before.attendees_json || '[]')),
      agenda: merged.agenda || null, minutes: merged.minutes || null,
    });
    const after = getMeetingById(id);
    writeBizAudit(db, { entity_type: 'meeting', entity_id: id, action: 'update', before, after, actor: data.actor });
    return after;
  });
  return run();
}

export function getMeetingById(id) {
  const db = bdb();
  const meeting = db.prepare(`SELECT m.*, c.name AS client_name FROM biz_meetings m LEFT JOIN biz_clients c ON c.id = m.client_id WHERE m.id = ?`).get(id);
  if (!meeting) return null;
  meeting.attendees = JSON.parse(meeting.attendees_json || '[]');
  meeting.decisions = db.prepare(`SELECT * FROM biz_meeting_decisions WHERE meeting_id = ? ORDER BY id ASC`).all(id);
  return meeting;
}

export function listMeetingsPaged({ client_id, contract_id, project_id, search, page = 1, pageSize = 30 } = {}) {
  const db = bdb();
  let where = ' WHERE 1=1';
  const params = {};
  if (client_id) { where += ' AND m.client_id = @client_id'; params.client_id = client_id; }
  if (contract_id) { where += ' AND m.contract_id = @contract_id'; params.contract_id = contract_id; }
  if (project_id) { where += ' AND m.project_id = @project_id'; params.project_id = project_id; }
  if (search) { where += ' AND m.title LIKE @search'; params.search = `%${search}%`; }
  const base = ` FROM biz_meetings m LEFT JOIN biz_clients c ON c.id = m.client_id${where}`;
  const total = db.prepare(`SELECT COUNT(*) AS n${base}`).get(params).n;
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(200, Math.max(1, Number(pageSize) || 30));
  const rows = db
    .prepare(`SELECT m.*, c.name AS client_name${base} ORDER BY m.meeting_date DESC, m.created_at DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: safePageSize, offset: (safePage - 1) * safePageSize });
  return { rows, total, page: safePage, pageSize: safePageSize, totalPages: Math.max(1, Math.ceil(total / safePageSize)) };
}

export function deleteMeeting(id, actor) {
  const db = bdb();
  const run = db.transaction(() => {
    const before = getMeetingById(id);
    if (!before) return { deleted: false };
    writeBizAudit(db, { entity_type: 'meeting', entity_id: id, action: 'delete', before, after: null, actor });
    db.prepare(`DELETE FROM biz_meetings WHERE id = ?`).run(id);
    return { deleted: true };
  });
  return run();
}

/** يضيف قراراً؛ إن طُلب (create_task=true) وكان الاجتماع مرتبطاً بمشروع فعلي، يُنشئ pm_task حقيقية. */
export function addMeetingDecision(meetingId, data) {
  const db = bdb();
  const run = db.transaction(() => {
    const meeting = getMeetingById(meetingId);
    if (!meeting) throw new Error('الاجتماع غير موجود.');
    if (!data.decision_text) throw new Error('نص القرار مطلوب.');

    let generatedTaskId = null;
    if (data.create_task && meeting.project_id) {
      const task = createTask({
        project_id: meeting.project_id,
        title: `[اجتماع] ${data.decision_text}`.slice(0, 200),
        description: `قرار ناتج عن اجتماع "${meeting.title}" بتاريخ ${meeting.meeting_date || ''}.`,
        planned_end: data.due_date || null,
        priority: 'medium',
      });
      generatedTaskId = task.id;
    }

    const info = db
      .prepare(`INSERT INTO biz_meeting_decisions (meeting_id, decision_text, responsible, due_date, generated_task_id) VALUES (@meeting_id, @decision_text, @responsible, @due_date, @generated_task_id)`)
      .run({ meeting_id: meetingId, decision_text: data.decision_text, responsible: data.responsible || null, due_date: data.due_date || null, generated_task_id: generatedTaskId });
    const created = db.prepare(`SELECT * FROM biz_meeting_decisions WHERE id = ?`).get(info.lastInsertRowid);
    writeBizAudit(db, { entity_type: 'meeting_decision', entity_id: created.id, action: 'create', before: null, after: created, actor: data.actor });
    return created;
  });
  return run();
}

export function updateDecisionStatus(id, status, actor) {
  const db = bdb();
  const run = db.transaction(() => {
    const before = db.prepare(`SELECT * FROM biz_meeting_decisions WHERE id = ?`).get(id);
    if (!before) throw new Error('القرار غير موجود.');
    db.prepare(`UPDATE biz_meeting_decisions SET status = ? WHERE id = ?`).run(status, id);
    const after = db.prepare(`SELECT * FROM biz_meeting_decisions WHERE id = ?`).get(id);
    writeBizAudit(db, { entity_type: 'meeting_decision', entity_id: id, action: 'status_change', before, after, actor });
    return after;
  });
  return run();
}
