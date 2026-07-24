// lib/pm/db/resources.js
import { randomUUID } from 'crypto';
import { pdb } from '../schema.js';
import { writePmAudit } from './audit.js';
import { findConflictsForResource } from '../resourceConflicts.js';

const RESOURCE_TYPES = ['labor', 'equipment', 'material', 'vehicle', 'warehouse', 'tool'];

// ---------- مستودع الموارد العام (Global Pool) ----------

export function listResources({ resource_type, search, is_active } = {}) {
  const db = pdb();
  let where = ' WHERE 1=1';
  const params = {};
  if (resource_type) { where += ' AND resource_type = @resource_type'; params.resource_type = resource_type; }
  if (search) { where += ' AND name LIKE @search'; params.search = `%${search}%`; }
  if (is_active !== undefined) { where += ' AND is_active = @is_active'; params.is_active = is_active ? 1 : 0; }
  return db.prepare(`SELECT * FROM pm_resources${where} ORDER BY resource_type, name`).all(params);
}

export function getResource(id) {
  return pdb().prepare(`SELECT * FROM pm_resources WHERE id = ?`).get(id);
}

export function createResource(data) {
  if (!RESOURCE_TYPES.includes(data.resource_type)) throw new Error(`نوع مورد غير معروف: ${data.resource_type}`);
  const db = pdb();
  const info = db
    .prepare(
      `INSERT INTO pm_resources (uuid, resource_type, name, identifier, unit, unit_cost, is_active, notes)
       VALUES (@uuid, @resource_type, @name, @identifier, @unit, @unit_cost, @is_active, @notes)`
    )
    .run({
      uuid: randomUUID(), resource_type: data.resource_type, name: data.name, identifier: data.identifier || null,
      unit: data.unit || null, unit_cost: Number(data.unit_cost) || 0, is_active: data.is_active === false ? 0 : 1, notes: data.notes || null,
    });
  return getResource(info.lastInsertRowid);
}

export function updateResource(id, data) {
  const db = pdb();
  const before = getResource(id);
  if (!before) throw new Error('المورد غير موجود.');
  const merged = { ...before, ...data };
  db.prepare(
    `UPDATE pm_resources SET name=@name, identifier=@identifier, unit=@unit, unit_cost=@unit_cost, is_active=@is_active, notes=@notes, updated_at=datetime('now') WHERE id=@id`
  ).run({
    id, name: merged.name, identifier: merged.identifier || null, unit: merged.unit || null,
    unit_cost: Number(merged.unit_cost) || 0, is_active: merged.is_active === false || merged.is_active === 0 ? 0 : 1, notes: merged.notes || null,
  });
  return getResource(id);
}

export function deleteResource(id) {
  const info = pdb().prepare(`DELETE FROM pm_resources WHERE id = ?`).run(id);
  return { deleted: info.changes > 0 };
}

// ---------- التعيينات على المشاريع ----------

export function listAssignments({ project_id, resource_id, resource_type } = {}) {
  const db = pdb();
  let where = ' WHERE 1=1';
  const params = {};
  if (project_id) { where += ' AND a.project_id = @project_id'; params.project_id = project_id; }
  if (resource_id) { where += ' AND a.resource_id = @resource_id'; params.resource_id = resource_id; }
  if (resource_type) { where += ' AND r.resource_type = @resource_type'; params.resource_type = resource_type; }
  return db
    .prepare(
      `SELECT a.*, r.name AS resource_name, r.resource_type, r.unit AS resource_unit, p.name AS project_name
       FROM pm_resource_assignments a
       JOIN pm_resources r ON r.id = a.resource_id
       JOIN projects p ON p.id = a.project_id
       ${where} ORDER BY a.start_date DESC`
    )
    .all(params);
}

export function createAssignment(data) {
  const db = pdb();
  const run = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO pm_resource_assignments (uuid, resource_id, project_id, quantity, start_date, end_date, cost, operating_hours, status, notes)
         VALUES (@uuid, @resource_id, @project_id, @quantity, @start_date, @end_date, @cost, @operating_hours, @status, @notes)`
      )
      .run({
        uuid: randomUUID(), resource_id: data.resource_id, project_id: data.project_id,
        quantity: Number(data.quantity) || 1, start_date: data.start_date || null, end_date: data.end_date || null,
        cost: Number(data.cost) || 0, operating_hours: Number(data.operating_hours) || 0,
        status: data.status || 'active', notes: data.notes || null,
      });
    const created = db.prepare(`SELECT * FROM pm_resource_assignments WHERE id = ?`).get(info.lastInsertRowid);
    writePmAudit(db, { project_id: created.project_id, entity_type: 'resource_assignment', entity_id: created.id, action: 'create', before: null, after: created, actor: data.actor });
    return created;
  });
  return run();
}

export function updateAssignment(id, data) {
  const db = pdb();
  const run = db.transaction(() => {
    const before = db.prepare(`SELECT * FROM pm_resource_assignments WHERE id = ?`).get(id);
    if (!before) throw new Error('التعيين غير موجود.');
    const merged = { ...before, ...data };
    db.prepare(
      `UPDATE pm_resource_assignments SET quantity=@quantity, start_date=@start_date, end_date=@end_date, cost=@cost,
         operating_hours=@operating_hours, status=@status, notes=@notes, updated_at=datetime('now') WHERE id=@id`
    ).run({
      id, quantity: Number(merged.quantity) || 1, start_date: merged.start_date || null, end_date: merged.end_date || null,
      cost: Number(merged.cost) || 0, operating_hours: Number(merged.operating_hours) || 0, status: merged.status, notes: merged.notes || null,
    });
    const after = db.prepare(`SELECT * FROM pm_resource_assignments WHERE id = ?`).get(id);
    writePmAudit(db, { project_id: after.project_id, entity_type: 'resource_assignment', entity_id: id, action: 'update', before, after, actor: data.actor });
    return after;
  });
  return run();
}

export function deleteAssignment(id, actor) {
  const db = pdb();
  const run = db.transaction(() => {
    const before = db.prepare(`SELECT * FROM pm_resource_assignments WHERE id = ?`).get(id);
    if (!before) return { deleted: false };
    db.prepare(`DELETE FROM pm_resource_assignments WHERE id = ?`).run(id);
    writePmAudit(db, { project_id: before.project_id, entity_type: 'resource_assignment', entity_id: id, action: 'delete', before, after: null, actor });
    return { deleted: true };
  });
  return run();
}

/** يفحص تعارض مورد واحد عبر كل المشاريع فعلياً (تداخل تواريخ حقيقي) - وليس تخميناً. */
export function getConflictsForResource(resourceId) {
  const assignments = pdb().prepare(`SELECT * FROM pm_resource_assignments WHERE resource_id = ?`).all(resourceId);
  return findConflictsForResource(assignments);
}

/** فحص شامل لكل الموارد التي لديها أكثر من تعيين نشط - لعرضها في لوحة الموارد. */
export function getAllResourceConflicts() {
  const db = pdb();
  const resourceIds = db
    .prepare(`SELECT resource_id FROM pm_resource_assignments WHERE status != 'cancelled' GROUP BY resource_id HAVING COUNT(*) > 1`)
    .all()
    .map((r) => r.resource_id);
  const result = [];
  for (const id of resourceIds) {
    const conflicts = getConflictsForResource(id);
    if (conflicts.length) {
      const resource = getResource(id);
      result.push({ resource, conflicts });
    }
  }
  return result;
}
