// lib/pm/db/budget.js
import { randomUUID } from 'crypto';
import { pdb } from '../schema.js';
import { writePmAudit } from './audit.js';
import { upsertNotification } from './notifications.js';
import { computeBudgetSummary } from '../budgetCalc.js';
import { buildBudgetNotification } from '../notifications.js';
import { getProjectById } from './projects.js';

const ITEM_TYPES = ['expense', 'revenue', 'purchase_order', 'change_order'];

export function listBudgetItems({ project_id, item_type, from, to } = {}) {
  const db = pdb();
  let where = ' WHERE 1=1';
  const params = {};
  if (project_id) { where += ' AND project_id = @project_id'; params.project_id = project_id; }
  if (item_type) { where += ' AND item_type = @item_type'; params.item_type = item_type; }
  if (from) { where += ' AND date >= @from'; params.from = from; }
  if (to) { where += ' AND date <= @to'; params.to = to; }
  return db.prepare(`SELECT * FROM pm_budget_items${where} ORDER BY date DESC, created_at DESC`).all(params);
}

export function getBudgetItem(id) {
  return pdb().prepare(`SELECT * FROM pm_budget_items WHERE id = ?`).get(id);
}

function checkBudgetThreshold(db, projectId) {
  const project = getProjectById(projectId);
  if (!project) return;
  const items = listBudgetItems({ project_id: projectId });
  const summary = computeBudgetSummary(project, items);
  const notif = buildBudgetNotification(project, summary);
  if (notif) upsertNotification({ ...notif, project_id: projectId });
}

export function createBudgetItem(data) {
  if (!ITEM_TYPES.includes(data.item_type)) throw new Error(`نوع بند مالي غير معروف: ${data.item_type}`);
  const db = pdb();
  const run = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO pm_budget_items (uuid, project_id, item_type, category, description, amount, date, reference_no, status, created_by)
         VALUES (@uuid, @project_id, @item_type, @category, @description, @amount, @date, @reference_no, @status, @created_by)`
      )
      .run({
        uuid: randomUUID(),
        project_id: data.project_id,
        item_type: data.item_type,
        category: data.category || null,
        description: data.description || null,
        amount: Number(data.amount) || 0,
        date: data.date || null,
        reference_no: data.reference_no || null,
        status: data.status || 'recorded',
        created_by: data.actor || null,
      });
    const created = getBudgetItem(info.lastInsertRowid);
    writePmAudit(db, { project_id: created.project_id, entity_type: 'budget_item', entity_id: created.id, action: 'create', before: null, after: created, actor: data.actor });
    return created;
  });
  const created = run();
  checkBudgetThreshold(db, created.project_id);
  return created;
}

export function updateBudgetItem(id, data) {
  const db = pdb();
  const run = db.transaction(() => {
    const before = getBudgetItem(id);
    if (!before) throw new Error('البند المالي غير موجود.');
    const merged = { ...before, ...data };
    db.prepare(
      `UPDATE pm_budget_items SET item_type=@item_type, category=@category, description=@description, amount=@amount,
         date=@date, reference_no=@reference_no, status=@status, updated_at=datetime('now') WHERE id=@id`
    ).run({
      id, item_type: merged.item_type, category: merged.category || null, description: merged.description || null,
      amount: Number(merged.amount) || 0, date: merged.date || null, reference_no: merged.reference_no || null, status: merged.status,
    });
    const after = getBudgetItem(id);
    writePmAudit(db, { project_id: after.project_id, entity_type: 'budget_item', entity_id: id, action: 'update', before, after, actor: data.actor });
    return after;
  });
  const after = run();
  checkBudgetThreshold(db, after.project_id);
  return after;
}

export function deleteBudgetItem(id, actor) {
  const db = pdb();
  const run = db.transaction(() => {
    const before = getBudgetItem(id);
    if (!before) return { deleted: false };
    db.prepare(`DELETE FROM pm_budget_items WHERE id = ?`).run(id);
    writePmAudit(db, { project_id: before.project_id, entity_type: 'budget_item', entity_id: id, action: 'delete', before, after: null, actor });
    return { deleted: true, project_id: before.project_id };
  });
  return run();
}

export function getBudgetSummaryForProject(projectId) {
  const project = getProjectById(projectId);
  if (!project) throw new Error('المشروع غير موجود.');
  const items = listBudgetItems({ project_id: projectId });
  return computeBudgetSummary(project, items);
}
