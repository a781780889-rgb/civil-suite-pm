// lib/hse/db/emergency.js
// إدارة الطوارئ (البند 11): خطط + فرق + تدريبات إخلاء. linked_document_id اختياري يشير لملف
// رسمي حقيقي في pm_documents (نفس التكامل المُطبَّق على خطط السلامة - انظر db/documents.js)
// حين تحتاج الخطة مرفقاً معتمَداً بإصدارات، بجانب الحقول النصية المهيكلة القابلة للاستعلام مباشرة.
import { randomUUID } from 'crypto';
import { hdb } from '../schema.js';
import { writeHseAudit } from './audit.js';
import { ValidationError } from '../../calc/common.js';

// -------------------- خطط الطوارئ --------------------
export function createEmergencyPlan(data, actor) {
  if (!data.project_id || !data.title) throw new ValidationError('المشروع وعنوان الخطة مطلوبان.');
  const db = hdb();
  const uuid = randomUUID();
  const info = db.prepare(
    `INSERT INTO hse_emergency_plans (uuid, project_id, plan_type, title, scenario, assembly_points, emergency_contacts, linked_document_id)
     VALUES (@uuid, @project_id, @plan_type, @title, @scenario, @assembly_points, @emergency_contacts, @linked_document_id)`
  ).run({ uuid, project_id: data.project_id, plan_type: data.plan_type || 'general', title: data.title,
    scenario: data.scenario || null, assembly_points: data.assembly_points || null,
    emergency_contacts: data.emergency_contacts ? JSON.stringify(data.emergency_contacts) : null, linked_document_id: data.linked_document_id || null });
  const created = getEmergencyPlanById(info.lastInsertRowid);
  writeHseAudit(db, { project_id: data.project_id, entity_type: 'emergency_plan', entity_id: created.id, action: 'create', before: null, after: created, actor });
  return created;
}

export function getEmergencyPlanById(id) {
  const row = hdb().prepare(`SELECT * FROM hse_emergency_plans WHERE id = ?`).get(id);
  return row ? { ...row, emergency_contacts: row.emergency_contacts ? JSON.parse(row.emergency_contacts) : [] } : null;
}

export function listEmergencyPlans({ project_id, plan_type } = {}) {
  const db = hdb();
  let where = ' WHERE 1=1';
  const params = {};
  if (project_id) { where += ' AND project_id = @project_id'; params.project_id = project_id; }
  if (plan_type) { where += ' AND plan_type = @plan_type'; params.plan_type = plan_type; }
  return db.prepare(`SELECT * FROM hse_emergency_plans${where} ORDER BY updated_at DESC`).all(params)
    .map((r) => ({ ...r, emergency_contacts: r.emergency_contacts ? JSON.parse(r.emergency_contacts) : [] }));
}

export function updateEmergencyPlan(id, data, actor) {
  const db = hdb();
  const run = db.transaction(() => {
    const before = getEmergencyPlanById(id);
    if (!before) throw new ValidationError('خطة الطوارئ غير موجودة.');
    const merged = { ...before, ...data };
    db.prepare(
      `UPDATE hse_emergency_plans SET plan_type=@plan_type, title=@title, scenario=@scenario, assembly_points=@assembly_points,
         emergency_contacts=@emergency_contacts, linked_document_id=@linked_document_id, is_active=@is_active,
         version=version+1, updated_at=datetime('now') WHERE id=@id`
    ).run({ id, plan_type: merged.plan_type, title: merged.title, scenario: merged.scenario, assembly_points: merged.assembly_points,
      emergency_contacts: JSON.stringify(merged.emergency_contacts || []), linked_document_id: merged.linked_document_id || null,
      is_active: merged.is_active === false ? 0 : 1 });
    const after = getEmergencyPlanById(id);
    writeHseAudit(db, { project_id: after.project_id, entity_type: 'emergency_plan', entity_id: id, action: 'update', before, after, actor });
    return after;
  });
  return run();
}

// -------------------- فرق الطوارئ --------------------
export function createEmergencyTeam(data, actor) {
  if (!data.project_id || !data.team_name) throw new ValidationError('المشروع واسم الفريق مطلوبان.');
  const db = hdb();
  const info = db.prepare(
    `INSERT INTO hse_emergency_teams (project_id, team_name, team_type, members) VALUES (@project_id, @team_name, @team_type, @members)`
  ).run({ project_id: data.project_id, team_name: data.team_name, team_type: data.team_type || 'evacuation', members: JSON.stringify(data.members || []) });
  const created = { ...db.prepare(`SELECT * FROM hse_emergency_teams WHERE id = ?`).get(info.lastInsertRowid) };
  created.members = JSON.parse(created.members || '[]');
  writeHseAudit(db, { project_id: data.project_id, entity_type: 'emergency_team', entity_id: created.id, action: 'create', before: null, after: created, actor });
  return created;
}

export function listEmergencyTeams(project_id) {
  return hdb().prepare(`SELECT * FROM hse_emergency_teams WHERE project_id = ? ORDER BY team_name ASC`).all(project_id)
    .map((r) => ({ ...r, members: JSON.parse(r.members || '[]') }));
}

// -------------------- تدريبات الإخلاء --------------------
export function recordEmergencyDrill(data, actor) {
  if (!data.project_id || !data.drill_date) throw new ValidationError('المشروع وتاريخ التدريب مطلوبان.');
  const db = hdb();
  const info = db.prepare(
    `INSERT INTO hse_emergency_drills (project_id, plan_id, drill_date, scenario, participants_count, response_time_minutes, evaluation_notes, evaluator)
     VALUES (@project_id, @plan_id, @drill_date, @scenario, @participants_count, @response_time_minutes, @evaluation_notes, @evaluator)`
  ).run({ project_id: data.project_id, plan_id: data.plan_id || null, drill_date: data.drill_date, scenario: data.scenario || null,
    participants_count: data.participants_count || null, response_time_minutes: data.response_time_minutes || null,
    evaluation_notes: data.evaluation_notes || null, evaluator: data.evaluator || actor || null });
  const created = hdb().prepare(`SELECT * FROM hse_emergency_drills WHERE id = ?`).get(info.lastInsertRowid);
  writeHseAudit(db, { project_id: data.project_id, entity_type: 'emergency_drill', entity_id: created.id, action: 'create', before: null, after: created, actor });
  return created;
}

export function listEmergencyDrills(project_id) {
  return hdb().prepare(`SELECT * FROM hse_emergency_drills WHERE project_id = ? ORDER BY drill_date DESC`).all(project_id);
}
