// lib/hse/db/risks.js
// سجل المخاطر (البند 3) مبني فوق منطق المصفوفة الحقيقي في lib/hse/riskMatrix.js - لا حساب
// درجة/مستوى الخطورة يتكرر هنا، فقط استدعاء computeRiskLevel() (مصدر واحد للحساب، يُختبر
// مستقلاً في tests/hse/riskMatrix.test.js).
import { randomUUID } from 'crypto';
import { hdb } from '../schema.js';
import { writeHseAudit } from './audit.js';
import { upsertNotification } from './notifications.js';
import { criticalRiskNotification } from '../notifications.js';
import { computeRiskLevel } from '../riskMatrix.js';
import { ValidationError } from '../../calc/common.js';

function validateRisk(data) {
  const errors = [];
  if (!data.project_id) errors.push('المشروع مطلوب.');
  if (!data.title || !data.title.trim()) errors.push('اسم الخطر مطلوب.');
  if (errors.length) throw new ValidationError(errors);
}

function nextRiskNo(db, id) {
  return `RISK-${String(id).padStart(5, '0')}`;
}

export function createRisk(data, actor) {
  validateRisk(data);
  const assessment = computeRiskLevel(data.likelihood, data.severity); // يرمي ValidationError إن كانت القيم خارج 1-5
  const db = hdb();
  const run = db.transaction(() => {
    const uuid = randomUUID();
    const info = db.prepare(
      `INSERT INTO hse_risks (
         uuid, risk_no, project_id, site_id, title, description, location, activity, category, cause,
         initial_likelihood, initial_severity, initial_score, initial_level,
         likelihood, severity, risk_score, risk_level, control_measures, responsible, review_date, status, created_by
       ) VALUES (
         @uuid, @risk_no, @project_id, @site_id, @title, @description, @location, @activity, @category, @cause,
         @likelihood, @severity, @score, @level,
         @likelihood, @severity, @score, @level, @control_measures, @responsible, @review_date, 'open', @created_by
       )`
    ).run({
      uuid, risk_no: 'TEMP', project_id: data.project_id, site_id: data.site_id || null,
      title: data.title.trim(), description: data.description || null, location: data.location || null,
      activity: data.activity || null, category: data.category || 'other', cause: data.cause || null,
      likelihood: assessment.likelihood, severity: assessment.severity, score: assessment.score, level: assessment.level,
      control_measures: data.control_measures || null, responsible: data.responsible || null,
      review_date: data.review_date || null, created_by: actor || null,
    });
    const id = info.lastInsertRowid;
    const risk_no = nextRiskNo(db, id);
    db.prepare(`UPDATE hse_risks SET risk_no = ? WHERE id = ?`).run(risk_no, id);
    const created = getRiskById(id);
    writeHseAudit(db, { project_id: data.project_id, entity_type: 'risk', entity_id: id, action: 'create', before: null, after: created, actor });
    if (created.risk_level === 'critical') upsertNotification(criticalRiskNotification(created));
    return created;
  });
  return run();
}

export function getRiskById(id) {
  return hdb().prepare(`SELECT * FROM hse_risks WHERE id = ?`).get(id);
}

export function listRisks({ project_id, site_id, status, risk_level, category, page = 1, pageSize = 20 } = {}) {
  const db = hdb();
  let where = ' WHERE 1=1';
  const params = {};
  if (project_id) { where += ' AND project_id = @project_id'; params.project_id = project_id; }
  if (site_id) { where += ' AND site_id = @site_id'; params.site_id = site_id; }
  if (status) { where += ' AND status = @status'; params.status = status; }
  if (risk_level) { where += ' AND risk_level = @risk_level'; params.risk_level = risk_level; }
  if (category) { where += ' AND category = @category'; params.category = category; }
  const total = db.prepare(`SELECT COUNT(*) AS c FROM hse_risks${where}`).get(params).c;
  const offset = (page - 1) * pageSize;
  const rows = db.prepare(
    `SELECT * FROM hse_risks${where}
     ORDER BY CASE risk_level WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END DESC, created_at DESC
     LIMIT @limit OFFSET @offset`
  ).all({ ...params, limit: pageSize, offset });
  return { rows, total, page, pageSize };
}

export function updateRisk(id, data, actor) {
  const db = hdb();
  const run = db.transaction(() => {
    const before = getRiskById(id);
    if (!before) throw new ValidationError('الخطر غير موجود.');
    const merged = { ...before, ...data };
    validateRisk(merged);
    db.prepare(
      `UPDATE hse_risks SET title=@title, description=@description, location=@location, activity=@activity,
         category=@category, cause=@cause, control_measures=@control_measures, responsible=@responsible,
         review_date=@review_date, site_id=@site_id, updated_at=datetime('now') WHERE id=@id`
    ).run({ id, title: merged.title, description: merged.description, location: merged.location,
      activity: merged.activity, category: merged.category, cause: merged.cause,
      control_measures: merged.control_measures, responsible: merged.responsible,
      review_date: merged.review_date, site_id: merged.site_id || null });
    const after = getRiskById(id);
    writeHseAudit(db, { project_id: after.project_id, entity_type: 'risk', entity_id: id, action: 'update', before, after, actor });
    return after;
  });
  return run();
}

/** إعادة تقييم الخطر بعد تطبيق إجراءات التحكم (البند 3: "إعادة تقييم الخطر بعد تطبيق إجراءات
 * المعالجة") - يحفظ نقطة تاريخية في hse_risk_reassessments ويحدّث القيم الحالية على السجل. */
export function reassessRisk(id, { likelihood, severity, note }, actor) {
  const assessment = computeRiskLevel(likelihood, severity);
  const db = hdb();
  const run = db.transaction(() => {
    const before = getRiskById(id);
    if (!before) throw new ValidationError('الخطر غير موجود.');
    db.prepare(
      `INSERT INTO hse_risk_reassessments (risk_id, likelihood, severity, risk_score, risk_level, note, assessed_by)
       VALUES (@risk_id, @likelihood, @severity, @score, @level, @note, @assessed_by)`
    ).run({ risk_id: id, likelihood: assessment.likelihood, severity: assessment.severity, score: assessment.score, level: assessment.level, note: note || null, assessed_by: actor || null });
    db.prepare(
      `UPDATE hse_risks SET likelihood=@likelihood, severity=@severity, risk_score=@score, risk_level=@level,
         status='reassessed', updated_at=datetime('now') WHERE id=@id`
    ).run({ id, likelihood: assessment.likelihood, severity: assessment.severity, score: assessment.score, level: assessment.level });
    const after = getRiskById(id);
    writeHseAudit(db, { project_id: after.project_id, entity_type: 'risk', entity_id: id, action: 'reassess', before, after, actor });
    if (after.risk_level === 'critical') upsertNotification(criticalRiskNotification(after));
    return after;
  });
  return run();
}

export function listRiskReassessments(riskId) {
  return hdb().prepare(`SELECT * FROM hse_risk_reassessments WHERE risk_id = ? ORDER BY created_at DESC`).all(riskId);
}

export function closeRisk(id, actor) {
  const db = hdb();
  const run = db.transaction(() => {
    const before = getRiskById(id);
    if (!before) throw new ValidationError('الخطر غير موجود.');
    db.prepare(`UPDATE hse_risks SET status='closed', updated_at=datetime('now') WHERE id=?`).run(id);
    const after = getRiskById(id);
    writeHseAudit(db, { project_id: after.project_id, entity_type: 'risk', entity_id: id, action: 'close', before, after, actor });
    return after;
  });
  return run();
}

export function deleteRisk(id, actor) {
  const db = hdb();
  const run = db.transaction(() => {
    const before = getRiskById(id);
    if (!before) return { deleted: false };
    db.prepare(`DELETE FROM hse_risks WHERE id = ?`).run(id);
    writeHseAudit(db, { project_id: before.project_id, entity_type: 'risk', entity_id: id, action: 'delete', before, after: null, actor });
    return { deleted: true };
  });
  return run();
}
