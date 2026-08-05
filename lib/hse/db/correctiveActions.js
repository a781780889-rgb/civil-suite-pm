// lib/hse/db/correctiveActions.js
// الإجراءات التصحيحية (البند 12) - جدول واحد متعدد المصدر (polymorphic) بدل تكراره في كل
// مصدر. كل دالة create* هنا تتحقق فعلياً من وجود السجل المصدر (SOURCE_TABLE_MAP) قبل الإدراج،
// لأن source_id بلا قيد FK خام (انظر تعليق hse_corrective_actions في schema.js) - التحقق هنا
// هو نفسه الضمان الفعلي البديل. "لا تعتبر الملاحظة مغلقة إلا بعد اعتماد المسؤول" (البند 12
// حرفياً) - closeCorrectiveAction ترفض أي طلب إغلاق بلا approved_by صريح.
import { randomUUID } from 'crypto';
import { hdb } from '../schema.js';
import { writeHseAudit } from './audit.js';
import { upsertNotification } from './notifications.js';
import { overdueCorrectiveActionNotification } from '../notifications.js';
import { ValidationError } from '../../calc/common.js';

const SOURCE_TABLE_MAP = {
  inspection_item: 'hse_inspection_items',
  incident: 'hse_incidents',
  near_miss: 'hse_near_misses',
  violation: 'hse_violations',
  risk: 'hse_risks',
};

function assertSourceExists(db, source_type, source_id) {
  const table = SOURCE_TABLE_MAP[source_type];
  if (!table) throw new ValidationError(`نوع المصدر "${source_type}" غير معروف.`);
  const row = db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(source_id);
  if (!row) throw new ValidationError(`السجل المصدر (${source_type} #${source_id}) غير موجود.`);
}

function validateAction(data) {
  const errors = [];
  if (!data.project_id) errors.push('المشروع مطلوب.');
  if (!data.source_type) errors.push('نوع المصدر مطلوب.');
  if (!data.source_id) errors.push('السجل المصدر مطلوب.');
  if (!data.description || !data.description.trim()) errors.push('وصف الإجراء التصحيحي مطلوب.');
  if (errors.length) throw new ValidationError(errors);
}

export function createCorrectiveAction(data, actor) {
  validateAction(data);
  const db = hdb();
  const run = db.transaction(() => {
    assertSourceExists(db, data.source_type, data.source_id);
    const uuid = randomUUID();
    const info = db.prepare(
      `INSERT INTO hse_corrective_actions (uuid, action_no, project_id, source_type, source_id, description, responsible, due_date, status, created_by)
       VALUES (@uuid, 'TEMP', @project_id, @source_type, @source_id, @description, @responsible, @due_date, 'open', @created_by)`
    ).run({ uuid, project_id: data.project_id, source_type: data.source_type, source_id: data.source_id,
      description: data.description.trim(), responsible: data.responsible || null, due_date: data.due_date || null, created_by: actor || null });
    const id = info.lastInsertRowid;
    db.prepare(`UPDATE hse_corrective_actions SET action_no = ? WHERE id = ?`).run(`CA-${String(id).padStart(5, '0')}`, id);
    const created = getCorrectiveActionById(id);
    writeHseAudit(db, { project_id: data.project_id, entity_type: 'corrective_action', entity_id: id, action: 'create', before: null, after: created, actor });
    return created;
  });
  return run();
}

export function getCorrectiveActionById(id) {
  return hdb().prepare(`SELECT * FROM hse_corrective_actions WHERE id = ?`).get(id);
}

export function listCorrectiveActions({ project_id, source_type, source_id, status, page = 1, pageSize = 20 } = {}) {
  const db = hdb();
  let where = ' WHERE 1=1';
  const params = {};
  if (project_id) { where += ' AND project_id = @project_id'; params.project_id = project_id; }
  if (source_type) { where += ' AND source_type = @source_type'; params.source_type = source_type; }
  if (source_id) { where += ' AND source_id = @source_id'; params.source_id = source_id; }
  if (status) { where += ' AND status = @status'; params.status = status; }
  const total = db.prepare(`SELECT COUNT(*) AS c FROM hse_corrective_actions${where}`).get(params).c;
  const offset = (page - 1) * pageSize;
  const rows = db.prepare(`SELECT * FROM hse_corrective_actions${where} ORDER BY (due_date IS NULL), due_date ASC, created_at DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: pageSize, offset });
  return { rows, total, page, pageSize };
}

/** تحديث نسبة الإنجاز/الحالة أثناء التنفيذ (لا يُغلق السجل - الإغلاق فقط عبر approveAndClose). */
export function updateCorrectiveActionProgress(id, { status, completion_pct, responsible, due_date }, actor) {
  const db = hdb();
  const run = db.transaction(() => {
    const before = getCorrectiveActionById(id);
    if (!before) throw new ValidationError('الإجراء التصحيحي غير موجود.');
    if (before.status === 'closed') throw new ValidationError('لا يمكن تعديل إجراء تصحيحي مغلق بالفعل.');
    const nextStatus = status && status !== 'closed' ? status : before.status; // closed لا تُمرَّر إلا عبر approveAndClose
    db.prepare(
      `UPDATE hse_corrective_actions SET status=@status, completion_pct=@completion_pct, responsible=@responsible,
         due_date=@due_date, updated_at=datetime('now') WHERE id=@id`
    ).run({ id, status: nextStatus, completion_pct: completion_pct ?? before.completion_pct,
      responsible: responsible ?? before.responsible, due_date: due_date ?? before.due_date });
    const after = getCorrectiveActionById(id);
    writeHseAudit(db, { project_id: after.project_id, entity_type: 'corrective_action', entity_id: id, action: 'update_progress', before, after, actor });
    return after;
  });
  return run();
}

/** الإغلاق الفعلي الوحيد - يتطلب اعتماد مسؤول صريح (البند 12 حرفياً: "لا تعتبر الملاحظة
 * مغلقة إلا بعد اعتماد المسؤول"). closure_evidence نصي (رابط/وصف إثبات الإغلاق). */
export function approveAndCloseCorrectiveAction(id, { approved_by, closure_evidence }, actor) {
  if (!approved_by) throw new ValidationError('اعتماد الإغلاق يتطلب تحديد اسم المعتمِد (approved_by).');
  const db = hdb();
  const run = db.transaction(() => {
    const before = getCorrectiveActionById(id);
    if (!before) throw new ValidationError('الإجراء التصحيحي غير موجود.');
    db.prepare(
      `UPDATE hse_corrective_actions SET status='closed', completion_pct=100, approved_by=@approved_by,
         approved_at=datetime('now'), closure_evidence=@closure_evidence, closed_at=datetime('now'),
         updated_at=datetime('now') WHERE id=@id`
    ).run({ id, approved_by, closure_evidence: closure_evidence || null });
    const after = getCorrectiveActionById(id);
    writeHseAudit(db, { project_id: after.project_id, entity_type: 'corrective_action', entity_id: id, action: 'approve_close', before, after, actor });
    return after;
  });
  return run();
}

export function listOverdueCorrectiveActions(project_id) {
  const db = hdb();
  const where = project_id ? 'AND project_id = ?' : '';
  const rows = db.prepare(
    `SELECT * FROM hse_corrective_actions WHERE status NOT IN ('closed','verified') AND due_date IS NOT NULL AND due_date < date('now') ${where}`
  ).all(...(project_id ? [project_id] : []));
  for (const action of rows) upsertNotification(overdueCorrectiveActionNotification(action));
  return rows;
}
