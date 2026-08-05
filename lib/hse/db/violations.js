// lib/hse/db/violations.js
// المخالفات (الوثيقة الأولى، قسم "إدارة المخالفات") - كل مخالفة تُنشئ إجراءً تصحيحياً مرتبطاً
// تلقائياً (نفس فلسفة البند 12 المُطبَّقة على بنود التفتيش) لضمان متابعتها حتى الإغلاق الفعلي.
import { randomUUID } from 'crypto';
import { hdb } from '../schema.js';
import { writeHseAudit } from './audit.js';
import { upsertNotification } from './notifications.js';
import { openViolationNotification } from '../notifications.js';
import { createCorrectiveAction } from './correctiveActions.js';
import { ValidationError } from '../../calc/common.js';

function validateViolation(data) {
  const errors = [];
  if (!data.project_id) errors.push('المشروع مطلوب.');
  if (!data.violation_type) errors.push('نوع المخالفة مطلوب.');
  if (!data.violation_date) errors.push('تاريخ المخالفة مطلوب.');
  if (errors.length) throw new ValidationError(errors);
}

export function createViolation(data, actor) {
  validateViolation(data);
  const db = hdb();
  const run = db.transaction(() => {
    const uuid = randomUUID();
    const info = db.prepare(
      `INSERT INTO hse_violations (uuid, violation_no, project_id, site_id, violation_type, severity, responsible_person, location, violation_date, due_date, reported_by)
       VALUES (@uuid, 'TEMP', @project_id, @site_id, @violation_type, @severity, @responsible_person, @location, @violation_date, @due_date, @reported_by)`
    ).run({
      uuid, project_id: data.project_id, site_id: data.site_id || null, violation_type: data.violation_type,
      severity: data.severity || 'medium', responsible_person: data.responsible_person || null, location: data.location || null,
      violation_date: data.violation_date, due_date: data.due_date || null, reported_by: data.reported_by || actor || null,
    });
    const id = info.lastInsertRowid;
    db.prepare(`UPDATE hse_violations SET violation_no = ? WHERE id = ?`).run(`VIO-${String(id).padStart(5, '0')}`, id);
    // إجراء تصحيحي مرتبط تلقائياً - كل مخالفة يجب أن تُتابَع حتى إغلاق فعلي معتمَد (البند 12).
    const action = createCorrectiveAction({
      project_id: data.project_id, source_type: 'violation', source_id: id,
      description: `معالجة مخالفة: ${data.violation_type}`, responsible: data.responsible_person || null, due_date: data.due_date || null,
    }, actor);
    const created = getViolationById(id);
    writeHseAudit(db, { project_id: data.project_id, entity_type: 'violation', entity_id: id, action: 'create', before: null, after: created, actor });
    upsertNotification(openViolationNotification(created));
    return { ...created, corrective_action_id: action.id };
  });
  return run();
}

export function getViolationById(id) {
  return hdb().prepare(`SELECT * FROM hse_violations WHERE id = ?`).get(id);
}

export function listViolations({ project_id, site_id, status, severity, page = 1, pageSize = 20 } = {}) {
  const db = hdb();
  let where = ' WHERE 1=1';
  const params = {};
  if (project_id) { where += ' AND project_id = @project_id'; params.project_id = project_id; }
  if (site_id) { where += ' AND site_id = @site_id'; params.site_id = site_id; }
  if (status) { where += ' AND status = @status'; params.status = status; }
  if (severity) { where += ' AND severity = @severity'; params.severity = severity; }
  const total = db.prepare(`SELECT COUNT(*) AS c FROM hse_violations${where}`).get(params).c;
  const offset = (page - 1) * pageSize;
  const rows = db.prepare(`SELECT * FROM hse_violations${where} ORDER BY violation_date DESC, id DESC LIMIT @limit OFFSET @offset`).all({ ...params, limit: pageSize, offset });
  return { rows, total, page, pageSize };
}

export function closeViolation(id, actor) {
  const db = hdb();
  const run = db.transaction(() => {
    const before = getViolationById(id);
    if (!before) throw new ValidationError('المخالفة غير موجودة.');
    const openAction = db.prepare(`SELECT id FROM hse_corrective_actions WHERE source_type='violation' AND source_id=? AND status != 'closed'`).get(id);
    if (openAction) throw new ValidationError('لا يمكن إغلاق المخالفة قبل إغلاق إجرائها التصحيحي المرتبط (معتمَداً).');
    db.prepare(`UPDATE hse_violations SET status='closed', updated_at=datetime('now') WHERE id=?`).run(id);
    const after = getViolationById(id);
    writeHseAudit(db, { project_id: after.project_id, entity_type: 'violation', entity_id: id, action: 'close', before, after, actor });
    return after;
  });
  return run();
}
