// lib/schedule/db/resources.js
import { randomUUID } from 'crypto';
import { sdb } from '../schema.js';
import { writePmAudit } from '../../pm/db/audit.js';
import { findConflictsForResource } from '../../pm/resourceConflicts.js';

export function listResourcesForActivity(activityId) {
  return sdb().prepare(`
    SELECT ar.*, r.name AS resource_name, r.resource_type, r.unit, r.unit_cost
    FROM sch_activity_resources ar JOIN pm_resources r ON r.id = ar.resource_id
    WHERE ar.activity_id = ? ORDER BY ar.id ASC
  `).all(activityId);
}

export function listResourcesForSchedule(scheduleId) {
  return sdb().prepare(`
    SELECT ar.*, r.name AS resource_name, r.resource_type, r.unit, r.unit_cost, a.name AS activity_name, a.wbs_code
    FROM sch_activity_resources ar
    JOIN pm_resources r ON r.id = ar.resource_id
    JOIN sch_activities a ON a.id = ar.activity_id
    WHERE ar.schedule_id = ? ORDER BY a.wbs_code ASC
  `).all(scheduleId);
}

export function assignResource({ activity_id, resource_id, quantity, planned_hours, planned_cost, note }, actor) {
  const db = sdb();
  const activity = db.prepare(`SELECT * FROM sch_activities WHERE id = ?`).get(activity_id);
  if (!activity) throw new Error('النشاط غير موجود.');
  const resource = db.prepare(`SELECT * FROM pm_resources WHERE id = ?`).get(resource_id);
  if (!resource) throw new Error('المورد غير موجود.');

  const qty = Number(quantity) || 1;
  const uuid = randomUUID();
  const info = db.prepare(`
    INSERT INTO sch_activity_resources (uuid, schedule_id, activity_id, resource_id, quantity, planned_hours, planned_cost, start_date, end_date, note)
    VALUES (@uuid, @schedule_id, @activity_id, @resource_id, @quantity, @planned_hours, @planned_cost, @start_date, @end_date, @note)
  `).run({
    uuid, schedule_id: activity.schedule_id, activity_id, resource_id, quantity: qty,
    planned_hours: Number(planned_hours) || 0,
    planned_cost: planned_cost != null ? Number(planned_cost) : Math.round(qty * (resource.unit_cost || 0) * 100) / 100,
    start_date: activity.planned_start || null, end_date: activity.planned_end || null, note: note || null,
  });
  const row = db.prepare(`SELECT * FROM sch_activity_resources WHERE id = ?`).get(info.lastInsertRowid);
  writePmAudit(db, { project_id: activity.project_id, entity_type: 'sch_activity_resource', entity_id: row.id, action: 'create', after: row, actor });
  return row;
}

export function removeResourceAssignment(id, actor) {
  const db = sdb();
  const before = db.prepare(`SELECT * FROM sch_activity_resources WHERE id = ?`).get(id);
  if (!before) return;
  const activity = db.prepare(`SELECT project_id FROM sch_activities WHERE id = ?`).get(before.activity_id);
  db.prepare(`DELETE FROM sch_activity_resources WHERE id = ?`).run(id);
  writePmAudit(db, { project_id: activity?.project_id, entity_type: 'sch_activity_resource', entity_id: id, action: 'delete', before, actor });
}

/** يفحص تعارض مورد واحد عبر (أ) تعيينات مستوى المشروع القديمة و(ب) تعيينات مستوى النشاط الجديدة معاً - تعارض حقيقي عابر للمشاريع. */
export function findResourceConflicts(resourceId) {
  const db = sdb();
  const projectLevel = db.prepare(
    `SELECT id, project_id, resource_id, start_date, end_date, status FROM pm_resource_assignments WHERE resource_id = ?`
  ).all(resourceId);
  const activityLevel = db.prepare(`
    SELECT ar.id, a.project_id, ar.resource_id, ar.start_date, ar.end_date, 'active' AS status
    FROM sch_activity_resources ar JOIN sch_activities a ON a.id = ar.activity_id
    WHERE ar.resource_id = ?
  `).all(resourceId);
  return findConflictsForResource([...projectLevel, ...activityLevel]);
}

export function findAllResourceConflicts() {
  const db = sdb();
  const ids = db.prepare(`
    SELECT DISTINCT resource_id FROM sch_activity_resources
    UNION SELECT DISTINCT resource_id FROM pm_resource_assignments
  `).all().map((r) => r.resource_id);
  const out = [];
  for (const rid of ids) {
    const conflicts = findResourceConflicts(rid);
    if (conflicts.length) out.push({ resourceId: rid, conflicts });
  }
  return out;
}
