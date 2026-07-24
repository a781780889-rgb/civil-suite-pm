// lib/pm/db/team.js
import { randomUUID } from 'crypto';
import { pdb } from '../schema.js';
import { writePmAudit } from './audit.js';

export function listTeamMembers(projectId) {
  return pdb().prepare(`SELECT * FROM pm_team_members WHERE project_id = ? ORDER BY is_active DESC, name ASC`).all(projectId);
}

export function getTeamMember(id) {
  return pdb().prepare(`SELECT * FROM pm_team_members WHERE id = ?`).get(id);
}

export function createTeamMember(data) {
  const db = pdb();
  const run = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO pm_team_members (uuid, project_id, name, role, phone, email, cost_per_day, is_active, notes)
         VALUES (@uuid, @project_id, @name, @role, @phone, @email, @cost_per_day, @is_active, @notes)`
      )
      .run({
        uuid: randomUUID(),
        project_id: data.project_id,
        name: data.name,
        role: data.role,
        phone: data.phone || null,
        email: data.email || null,
        cost_per_day: Number(data.cost_per_day) || 0,
        is_active: data.is_active === false ? 0 : 1,
        notes: data.notes || null,
      });
    const created = getTeamMember(info.lastInsertRowid);
    writePmAudit(db, { project_id: created.project_id, entity_type: 'team_member', entity_id: created.id, action: 'create', before: null, after: created, actor: data.actor });
    return created;
  });
  return run();
}

export function updateTeamMember(id, data) {
  const db = pdb();
  const run = db.transaction(() => {
    const before = getTeamMember(id);
    if (!before) throw new Error('عضو الفريق غير موجود.');
    const merged = { ...before, ...data };
    db.prepare(
      `UPDATE pm_team_members SET name=@name, role=@role, phone=@phone, email=@email, cost_per_day=@cost_per_day,
         is_active=@is_active, notes=@notes, updated_at=datetime('now') WHERE id=@id`
    ).run({
      id, name: merged.name, role: merged.role, phone: merged.phone || null, email: merged.email || null,
      cost_per_day: Number(merged.cost_per_day) || 0, is_active: merged.is_active === false || merged.is_active === 0 ? 0 : 1,
      notes: merged.notes || null,
    });
    const after = getTeamMember(id);
    writePmAudit(db, { project_id: after.project_id, entity_type: 'team_member', entity_id: id, action: 'update', before, after, actor: data.actor });
    return after;
  });
  return run();
}

export function deleteTeamMember(id, actor) {
  const db = pdb();
  const run = db.transaction(() => {
    const before = getTeamMember(id);
    if (!before) return { deleted: false };
    db.prepare(`UPDATE pm_tasks SET assignee_id = NULL WHERE assignee_id = ?`).run(id);
    db.prepare(`DELETE FROM pm_team_members WHERE id = ?`).run(id);
    writePmAudit(db, { project_id: before.project_id, entity_type: 'team_member', entity_id: id, action: 'delete', before, after: null, actor });
    return { deleted: true };
  });
  return run();
}

// ---------- الحضور والانصراف ----------

export function listAttendance({ team_member_id, project_id, from, to }) {
  const db = pdb();
  let where = ' WHERE 1=1';
  const params = {};
  if (team_member_id) { where += ' AND team_member_id = @team_member_id'; params.team_member_id = team_member_id; }
  if (project_id) { where += ' AND project_id = @project_id'; params.project_id = project_id; }
  if (from) { where += ' AND date >= @from'; params.from = from; }
  if (to) { where += ' AND date <= @to'; params.to = to; }
  return db.prepare(`SELECT * FROM pm_attendance${where} ORDER BY date DESC`).all(params);
}

export function upsertAttendance(data) {
  const db = pdb();
  const info = db
    .prepare(
      `INSERT INTO pm_attendance (team_member_id, project_id, date, status, hours, notes)
       VALUES (@team_member_id, @project_id, @date, @status, @hours, @notes)
       ON CONFLICT(team_member_id, date) DO UPDATE SET status=excluded.status, hours=excluded.hours, notes=excluded.notes`
    )
    .run({
      team_member_id: data.team_member_id,
      project_id: data.project_id,
      date: data.date,
      status: data.status || 'present',
      hours: Number(data.hours) || 0,
      notes: data.notes || null,
    });
  const id = info.lastInsertRowid || db.prepare(`SELECT id FROM pm_attendance WHERE team_member_id=? AND date=?`).get(data.team_member_id, data.date).id;
  return db.prepare(`SELECT * FROM pm_attendance WHERE id = ?`).get(id);
}

export function deleteAttendance(id) {
  const info = pdb().prepare(`DELETE FROM pm_attendance WHERE id = ?`).run(id);
  return { deleted: info.changes > 0 };
}
