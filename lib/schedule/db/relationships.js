// lib/schedule/db/relationships.js
import { sdb } from '../schema.js';
import { writePmAudit } from '../../pm/db/audit.js';

export function listRelationships(scheduleId) {
  return sdb().prepare(`SELECT * FROM sch_relationships WHERE schedule_id = ? ORDER BY id ASC`).all(scheduleId);
}

export function listRelationshipsForActivity(activityId) {
  return sdb().prepare(`SELECT * FROM sch_relationships WHERE predecessor_id = ? OR successor_id = ? ORDER BY id ASC`).all(activityId, activityId);
}

/** BFS للتحقق هل يوجد مسار موجود بالفعل من fromId إلى toId عبر العلاقات الحالية - يكشف الدورات قبل إضافة علاقة جديدة قد تُغلقها. */
function pathExists(db, scheduleId, fromId, toId) {
  const rels = db.prepare(`SELECT predecessor_id, successor_id FROM sch_relationships WHERE schedule_id = ?`).all(scheduleId);
  const adj = new Map();
  for (const r of rels) {
    if (!adj.has(r.predecessor_id)) adj.set(r.predecessor_id, []);
    adj.get(r.predecessor_id).push(r.successor_id);
  }
  const visited = new Set([fromId]);
  const queue = [fromId];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === toId) return true;
    for (const next of (adj.get(cur) || [])) {
      if (!visited.has(next)) { visited.add(next); queue.push(next); }
    }
  }
  return false;
}

export function createRelationship({ schedule_id, predecessor_id, successor_id, rel_type, lag_days }, actor) {
  if (predecessor_id === successor_id) throw new Error('لا يمكن ربط نشاط بنفسه.');
  const db = sdb();
  const pred = db.prepare(`SELECT id, schedule_id FROM sch_activities WHERE id = ?`).get(predecessor_id);
  const succ = db.prepare(`SELECT id, schedule_id FROM sch_activities WHERE id = ?`).get(successor_id);
  if (!pred || !succ) throw new Error('أحد النشاطين غير موجود.');
  if (pred.schedule_id !== succ.schedule_id) throw new Error('لا يمكن ربط أنشطة من جداول زمنية مختلفة.');
  const scheduleId = schedule_id || pred.schedule_id;

  const dup = db.prepare(`SELECT id FROM sch_relationships WHERE predecessor_id = ? AND successor_id = ?`).get(predecessor_id, successor_id);
  if (dup) throw new Error('توجد علاقة بالفعل بين هذين النشاطين.');

  if (pathExists(db, scheduleId, successor_id, predecessor_id)) {
    throw new Error('لا يمكن إضافة هذه العلاقة - ستُنشئ دورة (Circular Dependency) في الجدول الزمني.');
  }

  const schedule = db.prepare(`SELECT project_id FROM sch_schedules WHERE id = ?`).get(scheduleId);
  const info = db.prepare(
    `INSERT INTO sch_relationships (schedule_id, predecessor_id, successor_id, rel_type, lag_days) VALUES (@schedule_id, @predecessor_id, @successor_id, @rel_type, @lag_days)`
  ).run({ schedule_id: scheduleId, predecessor_id, successor_id, rel_type: rel_type || 'FS', lag_days: Number(lag_days) || 0 });
  const row = db.prepare(`SELECT * FROM sch_relationships WHERE id = ?`).get(info.lastInsertRowid);
  writePmAudit(db, { project_id: schedule?.project_id, entity_type: 'sch_relationship', entity_id: row.id, action: 'create', after: row, actor });
  return row;
}

export function updateRelationship(id, data, actor) {
  const db = sdb();
  const before = db.prepare(`SELECT * FROM sch_relationships WHERE id = ?`).get(id);
  if (!before) throw new Error('العلاقة غير موجودة.');
  const relType = data.rel_type || before.rel_type;
  const lag = data.lag_days != null ? Number(data.lag_days) : before.lag_days;
  db.prepare(`UPDATE sch_relationships SET rel_type = ?, lag_days = ? WHERE id = ?`).run(relType, lag, id);
  const after = db.prepare(`SELECT * FROM sch_relationships WHERE id = ?`).get(id);
  const schedule = db.prepare(`SELECT project_id FROM sch_schedules WHERE id = ?`).get(before.schedule_id);
  writePmAudit(db, { project_id: schedule?.project_id, entity_type: 'sch_relationship', entity_id: id, action: 'update', before, after, actor });
  return after;
}

export function deleteRelationship(id, actor) {
  const db = sdb();
  const before = db.prepare(`SELECT * FROM sch_relationships WHERE id = ?`).get(id);
  if (!before) return;
  const schedule = db.prepare(`SELECT project_id FROM sch_schedules WHERE id = ?`).get(before.schedule_id);
  db.prepare(`DELETE FROM sch_relationships WHERE id = ?`).run(id);
  writePmAudit(db, { project_id: schedule?.project_id, entity_type: 'sch_relationship', entity_id: id, action: 'delete', before, actor });
}
