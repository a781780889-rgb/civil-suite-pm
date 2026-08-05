// lib/hse/db/permits.js
// تصاريح العمل Permit to Work (البند 5). تكاملان حقيقيان فعّالان هنا (وليسا نية معلنة فقط):
//  1) سجل الموافقات الفعلي عبر biz_approvals (lib/business/db/approvals.js) المُعاد استخدامه
//     حرفياً - بدل تكرار نفس أعمدة "من وافق/متى/بأي قرار" التي بناها القسم السادس أصلاً.
//  2) بوابة سلامة حقيقية مع قسم المعدات (البند 13: "يمنع تشغيل معدة غير صالحة/انتهى فحصها") -
//     اعتماد أي تصريح مرتبط بمعدة out_of_service أو فشلت في آخر فحص equipment_inspections
//     يُرفض فعلياً (ValidationError → 400) قبل حفظ الاعتماد، وليس مجرد تنبيه شكلي في الواجهة.
import { randomUUID } from 'crypto';
import { hdb, PERMIT_STATUSES } from '../schema.js';
import { bdb } from '../../business/schema.js';
import { recordApproval, listApprovals } from '../../business/db/approvals.js';
import { writeHseAudit } from './audit.js';
import { ValidationError } from '../../calc/common.js';

function validatePermit(data) {
  const errors = [];
  if (!data.project_id) errors.push('المشروع مطلوب.');
  if (!data.permit_type) errors.push('نوع التصريح مطلوب.');
  if (!data.start_date) errors.push('تاريخ البداية مطلوب.');
  if (!data.end_date) errors.push('تاريخ الانتهاء مطلوب.');
  if (data.start_date && data.end_date && data.start_date > data.end_date) errors.push('تاريخ الانتهاء يجب ألا يسبق تاريخ البداية.');
  if (errors.length) throw new ValidationError(errors);
}

/** بوابة السلامة الحقيقية مع قسم المعدات (البند 13) - تُستدعى فقط عند اعتماد تصريح مرتبط بمعدة. */
function assertEquipmentFitForPermit(db, equipmentId) {
  const eq = db.prepare(`SELECT id, name, equipment_code, status FROM equipment_assets WHERE id = ?`).get(equipmentId);
  if (!eq) throw new ValidationError('المعدة المرتبطة بالتصريح غير موجودة في سجل المعدات.');
  if (['out_of_service', 'stopped', 'sold', 'archived'].includes(eq.status)) {
    throw new ValidationError(`لا يمكن اعتماد التصريح: المعدة "${eq.name}" (${eq.equipment_code}) بحالة "${eq.status}" - خارج الخدمة فعلياً.`);
  }
  const lastInspection = db.prepare(`SELECT result, inspection_date FROM equipment_inspections WHERE equipment_id = ? ORDER BY inspection_date DESC, id DESC LIMIT 1`).get(equipmentId);
  if (lastInspection && lastInspection.result === 'fail') {
    throw new ValidationError(`لا يمكن اعتماد التصريح: آخر فحص سلامة للمعدة "${eq.name}" بتاريخ ${lastInspection.inspection_date} كانت نتيجته "راسب".`);
  }
}

export function createPermit(data, actor) {
  validatePermit(data);
  const db = hdb();
  const run = db.transaction(() => {
    const uuid = randomUUID();
    const info = db.prepare(
      `INSERT INTO hse_permits (uuid, permit_no, project_id, site_id, permit_type, activity, location, start_date, end_date,
         responsible, team_members, equipment_id, linked_risk_id, required_ppe, safety_conditions, status, created_by)
       VALUES (@uuid, 'TEMP', @project_id, @site_id, @permit_type, @activity, @location, @start_date, @end_date,
         @responsible, @team_members, @equipment_id, @linked_risk_id, @required_ppe, @safety_conditions, 'draft', @created_by)`
    ).run({
      uuid, project_id: data.project_id, site_id: data.site_id || null, permit_type: data.permit_type,
      activity: data.activity || null, location: data.location || null, start_date: data.start_date, end_date: data.end_date,
      responsible: data.responsible || null, team_members: data.team_members || null, equipment_id: data.equipment_id || null,
      linked_risk_id: data.linked_risk_id || null, required_ppe: data.required_ppe || null,
      safety_conditions: data.safety_conditions || null, created_by: actor || null,
    });
    const id = info.lastInsertRowid;
    db.prepare(`UPDATE hse_permits SET permit_no = ? WHERE id = ?`).run(`PTW-${String(id).padStart(5, '0')}`, id);
    const created = getPermitById(id);
    writeHseAudit(db, { project_id: data.project_id, entity_type: 'permit', entity_id: id, action: 'create', before: null, after: created, actor });
    return created;
  });
  return run();
}

export function getPermitById(id) {
  return hdb().prepare(`SELECT * FROM hse_permits WHERE id = ?`).get(id);
}

export function getPermitWithApprovals(id) {
  const permit = getPermitById(id);
  if (!permit) return null;
  return { ...permit, approvals: listApprovals({ entity_type: 'hse_permit', entity_id: id }) };
}

export function listPermits({ project_id, site_id, status, permit_type, page = 1, pageSize = 20 } = {}) {
  const db = hdb();
  let where = ' WHERE 1=1';
  const params = {};
  if (project_id) { where += ' AND project_id = @project_id'; params.project_id = project_id; }
  if (site_id) { where += ' AND site_id = @site_id'; params.site_id = site_id; }
  if (status) { where += ' AND status = @status'; params.status = status; }
  if (permit_type) { where += ' AND permit_type = @permit_type'; params.permit_type = permit_type; }
  const total = db.prepare(`SELECT COUNT(*) AS c FROM hse_permits${where}`).get(params).c;
  const offset = (page - 1) * pageSize;
  const rows = db.prepare(`SELECT * FROM hse_permits${where} ORDER BY end_date ASC, id DESC LIMIT @limit OFFSET @offset`).all({ ...params, limit: pageSize, offset });
  return { rows, total, page, pageSize };
}

export function updatePermit(id, data, actor) {
  const db = hdb();
  const run = db.transaction(() => {
    const before = getPermitById(id);
    if (!before) throw new ValidationError('التصريح غير موجود.');
    if (!['draft', 'rejected'].includes(before.status)) throw new ValidationError('لا يمكن تعديل تصريح بعد إرساله للاعتماد.');
    const merged = { ...before, ...data };
    validatePermit(merged);
    db.prepare(
      `UPDATE hse_permits SET permit_type=@permit_type, activity=@activity, location=@location, start_date=@start_date,
         end_date=@end_date, responsible=@responsible, team_members=@team_members, equipment_id=@equipment_id,
         linked_risk_id=@linked_risk_id, required_ppe=@required_ppe, safety_conditions=@safety_conditions,
         site_id=@site_id, updated_at=datetime('now') WHERE id=@id`
    ).run({ id, permit_type: merged.permit_type, activity: merged.activity, location: merged.location,
      start_date: merged.start_date, end_date: merged.end_date, responsible: merged.responsible,
      team_members: merged.team_members, equipment_id: merged.equipment_id || null, linked_risk_id: merged.linked_risk_id || null,
      required_ppe: merged.required_ppe, safety_conditions: merged.safety_conditions, site_id: merged.site_id || null });
    const after = getPermitById(id);
    writeHseAudit(db, { project_id: after.project_id, entity_type: 'permit', entity_id: id, action: 'update', before, after, actor });
    return after;
  });
  return run();
}

export function submitPermitForApproval(id, actor, actor_role) {
  const db = hdb();
  bdb(); // يضمن جهوزية جدول biz_approvals قبل استخدامه (نفس فكرة pdb() الكسولة عبر الأقسام)
  const run = db.transaction(() => {
    const before = getPermitById(id);
    if (!before) throw new ValidationError('التصريح غير موجود.');
    if (before.status !== 'draft') throw new ValidationError('لا يمكن إرسال تصريح للاعتماد إلا من حالة "مسودة".');
    db.prepare(`UPDATE hse_permits SET status='pending_approval', updated_at=datetime('now') WHERE id=?`).run(id);
    recordApproval(db, { entity_type: 'hse_permit', entity_id: id, action: 'submit', decision: null, notes: null, actor, actor_role });
    const after = getPermitById(id);
    writeHseAudit(db, { project_id: after.project_id, entity_type: 'permit', entity_id: id, action: 'submit', before, after, actor });
    return after;
  });
  return run();
}

/** decision: 'approved' | 'rejected'. عند 'approved' لمعدة مرتبطة، تُطبَّق بوابة السلامة
 * الحقيقية (البند 13) قبل أي حفظ - رفض فعلي 400 وليس تحذيراً شكلياً. */
export function decidePermit(id, { decision, notes }, actor, actor_role) {
  if (!['approved', 'rejected'].includes(decision)) throw new ValidationError('القرار يجب أن يكون approved أو rejected.');
  const db = hdb();
  bdb();
  const run = db.transaction(() => {
    const before = getPermitById(id);
    if (!before) throw new ValidationError('التصريح غير موجود.');
    if (before.status !== 'pending_approval') throw new ValidationError('لا يمكن اعتماد/رفض تصريح ليس بانتظار الاعتماد.');
    if (decision === 'approved' && before.equipment_id) assertEquipmentFitForPermit(db, before.equipment_id);
    const nextStatus = decision === 'approved' ? 'approved' : 'rejected';
    db.prepare(`UPDATE hse_permits SET status=@status, updated_at=datetime('now') WHERE id=@id`).run({ id, status: nextStatus });
    recordApproval(db, { entity_type: 'hse_permit', entity_id: id, action: 'approve', decision, notes, actor, actor_role });
    const after = getPermitById(id);
    writeHseAudit(db, { project_id: after.project_id, entity_type: 'permit', entity_id: id, action: decision, before, after, actor });
    return after;
  });
  return run();
}

export function activatePermit(id, actor) {
  const db = hdb();
  const run = db.transaction(() => {
    const before = getPermitById(id);
    if (!before) throw new ValidationError('التصريح غير موجود.');
    if (before.status !== 'approved') throw new ValidationError('لا يمكن تفعيل تصريح لم يُعتمد بعد.');
    db.prepare(`UPDATE hse_permits SET status='active', updated_at=datetime('now') WHERE id=?`).run(id);
    const after = getPermitById(id);
    writeHseAudit(db, { project_id: after.project_id, entity_type: 'permit', entity_id: id, action: 'activate', before, after, actor });
    return after;
  });
  return run();
}

export function closePermit(id, { closed_by }, actor) {
  const db = hdb();
  const run = db.transaction(() => {
    const before = getPermitById(id);
    if (!before) throw new ValidationError('التصريح غير موجود.');
    if (!['approved', 'active'].includes(before.status)) throw new ValidationError('لا يمكن إغلاق تصريح بهذه الحالة.');
    db.prepare(`UPDATE hse_permits SET status='closed', closed_by=@closed_by, closed_at=datetime('now'), updated_at=datetime('now') WHERE id=@id`)
      .run({ id, closed_by: closed_by || actor || null });
    const after = getPermitById(id);
    writeHseAudit(db, { project_id: after.project_id, entity_type: 'permit', entity_id: id, action: 'close', before, after, actor });
    return after;
  });
  return run();
}

export function cancelPermit(id, actor) {
  const db = hdb();
  const run = db.transaction(() => {
    const before = getPermitById(id);
    if (!before) throw new ValidationError('التصريح غير موجود.');
    if (['closed', 'cancelled'].includes(before.status)) throw new ValidationError('التصريح مغلق/ملغى بالفعل.');
    db.prepare(`UPDATE hse_permits SET status='cancelled', updated_at=datetime('now') WHERE id=?`).run(id);
    const after = getPermitById(id);
    writeHseAudit(db, { project_id: after.project_id, entity_type: 'permit', entity_id: id, action: 'cancel', before, after, actor });
    return after;
  });
  return run();
}

export { PERMIT_STATUSES };
