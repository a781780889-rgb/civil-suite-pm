// lib/hse/db/training.js
// التدريب والشهادات (البند 10). حالة الشهادة تُحسب فعلياً من تاريخ الانتهاء عند كل قراءة
// (وليست علماً ثابتاً قد يصبح قديماً) - نفس مبدأ عدم تخزين قيمة مشتقة يمكن أن تُنسى تحديثها.
import { randomUUID } from 'crypto';
import { hdb } from '../schema.js';
import { writeHseAudit } from './audit.js';
import { ValidationError } from '../../calc/common.js';

function computeLiveStatus(cert) {
  if (cert.status === 'revoked') return 'revoked';
  if (cert.expiry_date && cert.expiry_date < new Date().toISOString().slice(0, 10)) return 'expired';
  return 'valid';
}

// -------------------- الدورات --------------------
export function createTrainingCourse(data, actor) {
  if (!data.course_name || !data.course_date) throw new ValidationError('اسم الدورة وتاريخها مطلوبان.');
  const db = hdb();
  const uuid = randomUUID();
  const info = db.prepare(
    `INSERT INTO hse_training_courses (uuid, course_name, provider, category, course_date, validity_days, project_id)
     VALUES (@uuid, @course_name, @provider, @category, @course_date, @validity_days, @project_id)`
  ).run({ uuid, course_name: data.course_name, provider: data.provider || null, category: data.category || null,
    course_date: data.course_date, validity_days: data.validity_days || null, project_id: data.project_id || null });
  const created = db.prepare(`SELECT * FROM hse_training_courses WHERE id = ?`).get(info.lastInsertRowid);
  writeHseAudit(db, { project_id: data.project_id || null, entity_type: 'training_course', entity_id: created.id, action: 'create', before: null, after: created, actor });
  return created;
}

export function listTrainingCourses({ project_id, category } = {}) {
  const db = hdb();
  let where = ' WHERE 1=1';
  const params = {};
  if (project_id) { where += ' AND project_id = @project_id'; params.project_id = project_id; }
  if (category) { where += ' AND category = @category'; params.category = category; }
  return db.prepare(`SELECT * FROM hse_training_courses${where} ORDER BY course_date DESC`).all(params);
}

// -------------------- الشهادات --------------------
function validateCert(data) {
  const errors = [];
  if (!data.course_id) errors.push('الدورة مطلوبة.');
  if (!data.trainee_name || !data.trainee_name.trim()) errors.push('اسم المتدرب مطلوب.');
  if (!data.issued_date) errors.push('تاريخ إصدار الشهادة مطلوب.');
  if (errors.length) throw new ValidationError(errors);
}

export function issueCertification(data, actor) {
  validateCert(data);
  const db = hdb();
  const run = db.transaction(() => {
    const course = db.prepare(`SELECT * FROM hse_training_courses WHERE id = ?`).get(data.course_id);
    if (!course) throw new ValidationError('الدورة غير موجودة.');
    let expiryDate = data.expiry_date || null;
    if (!expiryDate && course.validity_days) {
      const d = new Date(data.issued_date);
      d.setDate(d.getDate() + course.validity_days);
      expiryDate = d.toISOString().slice(0, 10);
    }
    const uuid = randomUUID();
    const info = db.prepare(
      `INSERT INTO hse_training_certifications (uuid, course_id, team_member_id, trainee_name, certificate_no, issued_date, expiry_date, evaluation_score, status)
       VALUES (@uuid, @course_id, @team_member_id, @trainee_name, @certificate_no, @issued_date, @expiry_date, @evaluation_score, 'valid')`
    ).run({ uuid, course_id: data.course_id, team_member_id: data.team_member_id || null, trainee_name: data.trainee_name.trim(),
      certificate_no: data.certificate_no || `CERT-${Date.now()}`, issued_date: data.issued_date, expiry_date: expiryDate,
      evaluation_score: data.evaluation_score ?? null });
    const created = getCertificationById(info.lastInsertRowid);
    writeHseAudit(db, { project_id: course.project_id, entity_type: 'training_certification', entity_id: created.id, action: 'create', before: null, after: created, actor });
    return created;
  });
  return run();
}

export function getCertificationById(id) {
  const row = hdb().prepare(
    `SELECT c.*, co.course_name, co.provider, co.category FROM hse_training_certifications c JOIN hse_training_courses co ON co.id = c.course_id WHERE c.id = ?`
  ).get(id);
  return row ? { ...row, status: computeLiveStatus(row) } : null;
}

export function listCertifications({ course_id, trainee_name, status, page = 1, pageSize = 20 } = {}) {
  const db = hdb();
  let where = ' WHERE 1=1';
  const params = {};
  if (course_id) { where += ' AND c.course_id = @course_id'; params.course_id = course_id; }
  if (trainee_name) { where += ' AND c.trainee_name LIKE @trainee_name'; params.trainee_name = `%${trainee_name}%`; }
  const total = db.prepare(`SELECT COUNT(*) AS c FROM hse_training_certifications c${where}`).get(params).c;
  const offset = (page - 1) * pageSize;
  let rows = db.prepare(
    `SELECT c.*, co.course_name, co.provider, co.category FROM hse_training_certifications c JOIN hse_training_courses co ON co.id = c.course_id${where}
     ORDER BY c.expiry_date IS NULL, c.expiry_date ASC LIMIT @limit OFFSET @offset`
  ).all({ ...params, limit: pageSize, offset }).map((r) => ({ ...r, status: computeLiveStatus(r) }));
  if (status) rows = rows.filter((r) => r.status === status);
  return { rows, total, page, pageSize };
}

export function revokeCertification(id, actor) {
  const db = hdb();
  const run = db.transaction(() => {
    const before = getCertificationById(id);
    if (!before) throw new ValidationError('الشهادة غير موجودة.');
    db.prepare(`UPDATE hse_training_certifications SET status='revoked' WHERE id=?`).run(id);
    const after = getCertificationById(id);
    writeHseAudit(db, { project_id: null, entity_type: 'training_certification', entity_id: id, action: 'revoke', before, after, actor });
    return after;
  });
  return run();
}
