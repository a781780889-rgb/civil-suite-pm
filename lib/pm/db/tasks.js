// lib/pm/db/tasks.js
// =============================================================================
// إدارة المهام (قاعدة رابعاً الإلزامية). كل إنشاء/تعديل يُعيد حساب نسبة إنجاز المرحلة
// والمهمة الأب تلقائياً من مهامها الفرعية (computeWeightedProgress) - يلبي "تحديث نسبة
// إنجاز المشروع تلقائياً بناءً على المهام" دون تدخل يدوي أو معامل تقريبي.
// =============================================================================

import { randomUUID } from 'crypto';
import { pdb } from '../schema.js';
import { writePmAudit, listPmAuditLog } from './audit.js';
import { computePhaseProgress, computeTaskProgressFromSubtasks } from '../progress.js';

function daysBetweenInclusive(startStr, endStr) {
  const a = new Date(startStr);
  const b = new Date(endStr);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000)) + 1;
}

function deriveDuration(data, fallback) {
  if (data.planned_start && data.planned_end) {
    const d = daysBetweenInclusive(data.planned_start, data.planned_end);
    if (d !== null) return Math.max(1, d);
  }
  return data.duration_days !== undefined && data.duration_days !== null && data.duration_days !== ''
    ? Math.max(0.5, Number(data.duration_days))
    : fallback ?? 1;
}

function validateDates(data) {
  if (data.planned_start && data.planned_end && data.planned_start > data.planned_end) {
    throw new Error('تعارض تواريخ: تاريخ بداية المهمة لاحق لتاريخ نهايتها.');
  }
  if (data.actual_start && data.actual_end && data.actual_start > data.actual_end) {
    throw new Error('تعارض تواريخ: تاريخ البداية الفعلي لاحق لتاريخ النهاية الفعلي.');
  }
}

function recomputePhaseProgress(db, phaseId) {
  if (!phaseId) return;
  const tasksInPhase = db.prepare(`SELECT duration_days, progress_pct, parent_task_id FROM pm_tasks WHERE phase_id = ?`).all(phaseId);
  const pct = computePhaseProgress(tasksInPhase);
  if (pct !== null) {
    db.prepare(`UPDATE pm_phases SET progress_pct = ?, updated_at = datetime('now') WHERE id = ?`).run(pct, phaseId);
  }
}

function recomputeParentTaskProgress(db, parentId) {
  if (!parentId) return;
  const subtasks = db.prepare(`SELECT duration_days, progress_pct FROM pm_tasks WHERE parent_task_id = ?`).all(parentId);
  const pct = computeTaskProgressFromSubtasks(subtasks);
  if (pct !== null) {
    db.prepare(`UPDATE pm_tasks SET progress_pct = ?, updated_at = datetime('now') WHERE id = ?`).run(pct, parentId);
    const parent = db.prepare(`SELECT phase_id, parent_task_id FROM pm_tasks WHERE id = ?`).get(parentId);
    if (parent?.phase_id) recomputePhaseProgress(db, parent.phase_id);
    if (parent?.parent_task_id) recomputeParentTaskProgress(db, parent.parent_task_id); // دعم تعشيش أعمق من مستوى واحد
  }
}

export function listTasks({ project_id, phase_id, parent_task_id, assignee_id, status, priority, search, page, pageSize } = {}) {
  const db = pdb();
  let where = ' WHERE 1=1';
  const params = {};
  if (project_id) { where += ' AND project_id = @project_id'; params.project_id = project_id; }
  if (phase_id) { where += ' AND phase_id = @phase_id'; params.phase_id = phase_id; }
  if (assignee_id) { where += ' AND assignee_id = @assignee_id'; params.assignee_id = assignee_id; }
  if (status) { where += ' AND status = @status'; params.status = status; }
  if (priority) { where += ' AND priority = @priority'; params.priority = priority; }
  if (search) { where += ' AND title LIKE @search'; params.search = `%${search}%`; }
  if (parent_task_id === 'root') where += ' AND parent_task_id IS NULL';
  else if (parent_task_id) { where += ' AND parent_task_id = @parent_task_id'; params.parent_task_id = parent_task_id; }

  if (!page) {
    return db.prepare(`SELECT * FROM pm_tasks${where} ORDER BY planned_start IS NULL, planned_start ASC, id ASC`).all(params);
  }
  const total = db.prepare(`SELECT COUNT(*) AS n FROM pm_tasks${where}`).get(params).n;
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(500, Math.max(1, Number(pageSize) || 100));
  const rows = db
    .prepare(`SELECT * FROM pm_tasks${where} ORDER BY planned_start IS NULL, planned_start ASC, id ASC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: safePageSize, offset: (safePage - 1) * safePageSize });
  return { rows, total, page: safePage, pageSize: safePageSize, totalPages: Math.max(1, Math.ceil(total / safePageSize)) };
}

export function getTask(id) {
  return pdb().prepare(`SELECT * FROM pm_tasks WHERE id = ?`).get(id);
}

export function createTask(data) {
  validateDates(data);
  const db = pdb();
  const run = db.transaction(() => {
    const duration = deriveDuration(data);
    const info = db
      .prepare(
        `INSERT INTO pm_tasks (uuid, project_id, phase_id, parent_task_id, title, description, assignee_id, priority, status,
           planned_start, planned_end, actual_start, actual_end, duration_days, progress_pct, is_recurring, recurrence_rule)
         VALUES (@uuid, @project_id, @phase_id, @parent_task_id, @title, @description, @assignee_id, @priority, @status,
           @planned_start, @planned_end, @actual_start, @actual_end, @duration_days, @progress_pct, @is_recurring, @recurrence_rule)`
      )
      .run({
        uuid: randomUUID(),
        project_id: data.project_id,
        phase_id: data.phase_id || null,
        parent_task_id: data.parent_task_id || null,
        title: data.title,
        description: data.description || null,
        assignee_id: data.assignee_id || null,
        priority: data.priority || 'medium',
        status: data.status || 'not_started',
        planned_start: data.planned_start || null,
        planned_end: data.planned_end || null,
        actual_start: data.actual_start || null,
        actual_end: data.actual_end || null,
        duration_days: duration,
        progress_pct: data.progress_pct || 0,
        is_recurring: data.is_recurring ? 1 : 0,
        recurrence_rule: data.recurrence_rule || null,
      });
    const created = getTask(info.lastInsertRowid);
    writePmAudit(db, { project_id: created.project_id, entity_type: 'task', entity_id: created.id, action: 'create', before: null, after: created, actor: data.actor });
    if (created.phase_id) recomputePhaseProgress(db, created.phase_id);
    if (created.parent_task_id) recomputeParentTaskProgress(db, created.parent_task_id);
    return created;
  });
  return run();
}

export function updateTask(id, data) {
  validateDates(data);
  const db = pdb();
  const run = db.transaction(() => {
    const before = getTask(id);
    if (!before) throw new Error('المهمة غير موجودة.');
    const merged = { ...before, ...data };
    const duration = deriveDuration(merged, before.duration_days);
    db.prepare(
      `UPDATE pm_tasks SET phase_id=@phase_id, parent_task_id=@parent_task_id, title=@title, description=@description,
         assignee_id=@assignee_id, priority=@priority, status=@status, planned_start=@planned_start, planned_end=@planned_end,
         actual_start=@actual_start, actual_end=@actual_end, duration_days=@duration_days, progress_pct=@progress_pct,
         is_recurring=@is_recurring, recurrence_rule=@recurrence_rule, updated_at=datetime('now') WHERE id=@id`
    ).run({
      id,
      phase_id: merged.phase_id || null,
      parent_task_id: merged.parent_task_id || null,
      title: merged.title,
      description: merged.description || null,
      assignee_id: merged.assignee_id || null,
      priority: merged.priority,
      status: merged.status,
      planned_start: merged.planned_start || null,
      planned_end: merged.planned_end || null,
      actual_start: merged.actual_start || null,
      actual_end: merged.actual_end || null,
      duration_days: duration,
      progress_pct: Math.max(0, Math.min(100, Number(merged.progress_pct) || 0)),
      is_recurring: merged.is_recurring ? 1 : 0,
      recurrence_rule: merged.recurrence_rule || null,
    });
    const after = getTask(id);
    writePmAudit(db, { project_id: after.project_id, entity_type: 'task', entity_id: id, action: 'update', before, after, actor: data.actor });
    // إعادة حساب المرحلة/المهمة الأب القديمة والجديدة إن تغيّر الربط
    if (before.phase_id) recomputePhaseProgress(db, before.phase_id);
    if (after.phase_id && after.phase_id !== before.phase_id) recomputePhaseProgress(db, after.phase_id);
    if (before.parent_task_id) recomputeParentTaskProgress(db, before.parent_task_id);
    if (after.parent_task_id && after.parent_task_id !== before.parent_task_id) recomputeParentTaskProgress(db, after.parent_task_id);
    return after;
  });
  return run();
}

export function deleteTask(id, actor) {
  const db = pdb();
  const run = db.transaction(() => {
    const before = getTask(id);
    if (!before) return { deleted: false };
    db.prepare(`DELETE FROM pm_tasks WHERE id = ?`).run(id); // CASCADE يحذف المهام الفرعية والتبعيات والتعليقات تلقائياً
    writePmAudit(db, { project_id: before.project_id, entity_type: 'task', entity_id: id, action: 'delete', before, after: null, actor });
    if (before.phase_id) recomputePhaseProgress(db, before.phase_id);
    if (before.parent_task_id) recomputeParentTaskProgress(db, before.parent_task_id);
    return { deleted: true };
  });
  return run();
}

export function listSubtasks(parentTaskId) {
  return pdb().prepare(`SELECT * FROM pm_tasks WHERE parent_task_id = ? ORDER BY planned_start IS NULL, planned_start ASC`).all(parentTaskId);
}

// ---------- التبعيات (Dependencies) ----------

export function listDependencies(taskId) {
  return pdb().prepare(`SELECT * FROM pm_task_dependencies WHERE task_id = ?`).all(taskId);
}

/** كل تبعيات مهام مشروع واحد دفعة واحدة - يُستخدم لمحرك المسار الحرج. */
export function listAllDependenciesForProject(projectId) {
  return pdb()
    .prepare(
      `SELECT d.* FROM pm_task_dependencies d JOIN pm_tasks t ON t.id = d.task_id WHERE t.project_id = ?`
    )
    .all(projectId);
}

export function addDependency({ task_id, depends_on_task_id, dep_type, lag_days }, actor) {
  if (Number(task_id) === Number(depends_on_task_id)) throw new Error('لا يمكن أن تعتمد المهمة على نفسها.');
  const db = pdb();
  const run = db.transaction(() => {
    const info = db
      .prepare(`INSERT OR IGNORE INTO pm_task_dependencies (task_id, depends_on_task_id, dep_type, lag_days) VALUES (?, ?, ?, ?)`)
      .run(task_id, depends_on_task_id, dep_type || 'FS', lag_days || 0);
    if (info.changes === 0) throw new Error('هذه التبعية موجودة بالفعل.');
    const task = getTask(task_id);
    writePmAudit(db, { project_id: task?.project_id, entity_type: 'task_dependency', entity_id: info.lastInsertRowid, action: 'create', before: null, after: { task_id, depends_on_task_id, dep_type, lag_days }, actor });
    return db.prepare(`SELECT * FROM pm_task_dependencies WHERE id = ?`).get(info.lastInsertRowid);
  });
  return run();
}

export function removeDependency(id, actor) {
  const db = pdb();
  const run = db.transaction(() => {
    const before = db.prepare(`SELECT * FROM pm_task_dependencies WHERE id = ?`).get(id);
    if (!before) return { deleted: false };
    db.prepare(`DELETE FROM pm_task_dependencies WHERE id = ?`).run(id);
    const task = getTask(before.task_id);
    writePmAudit(db, { project_id: task?.project_id, entity_type: 'task_dependency', entity_id: id, action: 'delete', before, after: null, actor });
    return { deleted: true };
  });
  return run();
}

// ---------- التعليقات ----------

export function listComments(taskId) {
  return pdb().prepare(`SELECT * FROM pm_task_comments WHERE task_id = ? ORDER BY created_at ASC`).all(taskId);
}

export function addComment({ task_id, author, comment }) {
  const info = pdb()
    .prepare(`INSERT INTO pm_task_comments (task_id, author, comment) VALUES (?, ?, ?)`)
    .run(task_id, author || null, comment);
  return pdb().prepare(`SELECT * FROM pm_task_comments WHERE id = ?`).get(info.lastInsertRowid);
}

// ---------- سجل التعديلات (من سجل التدقيق العام، مُفلتراً على هذه المهمة) ----------

export function listTaskHistory(taskId) {
  return listPmAuditLog({ entity_type: 'task', entity_id: taskId, limit: 100 });
}
