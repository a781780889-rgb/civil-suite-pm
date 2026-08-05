// lib/hse/db/incidents.js
// الحوادث والإصابات (البند 7). تكاملان حقيقيان اختياريان (يُفعَّلان صراحة بعلم/flag من طالب
// الطلب - وليسا سحرياً ضمنياً من تحليل نص حر): تعطيل معدة متضررة فعلياً في سجل المعدات
// (البند 13)، وإنشاء سجل جودة/NCR مرتبط فعلياً (البند 14) - كلاهما بنفس أسلوب try/catch
// الدفاعي في lib/equipment/db/breakdowns.js (فشل التكامل الثانوي لا يُسقط تسجيل الحادث نفسه).
import { randomUUID } from 'crypto';
import { hdb } from '../schema.js';
import { writeHseAudit } from './audit.js';
import { upsertNotification } from './notifications.js';
import { newIncidentNotification } from '../notifications.js';
import { ValidationError } from '../../calc/common.js';
// استيراد ثابت على مستوى الملف (وليس import() ديناميكياً) - db.transaction() في better-sqlite3
// يتطلب دالة callback متزامنة (synchronous) بالكامل بلا أي Promise/await بداخلها؛ نفس القيد
// الذي التزم به lib/equipment/db/breakdowns.js عند استدعائه createBudgetItem من pm/db/budget.js.
import { changeEquipmentStatus } from '../../equipment/db/equipment.js';

function validateIncident(data) {
  const errors = [];
  if (!data.project_id) errors.push('المشروع مطلوب.');
  if (!data.incident_type) errors.push('نوع الحادث مطلوب.');
  if (!data.incident_date) errors.push('تاريخ الحادث مطلوب.');
  if (errors.length) throw new ValidationError(errors);
}

export function createIncident(data, actor) {
  validateIncident(data);
  const db = hdb();
  const run = db.transaction(() => {
    const uuid = randomUUID();
    const info = db.prepare(
      `INSERT INTO hse_incidents (
         uuid, incident_no, project_id, site_id, incident_type, incident_date, incident_time, location,
         affected_persons, description, immediate_cause, root_cause, witnesses, damages_description,
         immediate_actions, equipment_id, reported_by
       ) VALUES (
         @uuid, 'TEMP', @project_id, @site_id, @incident_type, @incident_date, @incident_time, @location,
         @affected_persons, @description, @immediate_cause, @root_cause, @witnesses, @damages_description,
         @immediate_actions, @equipment_id, @reported_by
       )`
    ).run({
      uuid, project_id: data.project_id, site_id: data.site_id || null, incident_type: data.incident_type,
      incident_date: data.incident_date, incident_time: data.incident_time || null, location: data.location || null,
      affected_persons: JSON.stringify(data.affected_persons || []), description: data.description || null,
      immediate_cause: data.immediate_cause || null, root_cause: data.root_cause || null, witnesses: data.witnesses || null,
      damages_description: data.damages_description || null, immediate_actions: data.immediate_actions || null,
      equipment_id: data.equipment_id || null, reported_by: data.reported_by || actor || null,
    });
    const id = info.lastInsertRowid;
    db.prepare(`UPDATE hse_incidents SET incident_no = ? WHERE id = ?`).run(`INC-${String(id).padStart(5, '0')}`, id);

    // تكامل حقيقي اختياري مع قسم المعدات (البند 13) - يُفعَّل فقط عند طلب صريح mark_equipment_damaged.
    // try/catch دفاعي (نفس أسلوب equipment/db/breakdowns.js مع الميزانية): فشل تحديث حالة المعدة
    // لا يُسقط تسجيل الحادث نفسه - السلامة أولوية ولا يجوز أن يمنعها خطأ في قسم آخر.
    if (data.equipment_id && data.mark_equipment_damaged) {
      try {
        changeEquipmentStatus(data.equipment_id, 'stopped', `توقف بسبب حادث سلامة INC-${String(id).padStart(5, '0')}`, actor);
      } catch (err) {
        console.error('تعذّر تحديث حالة المعدة من الحادث:', err.message);
      }
    }
    const created = getIncidentById(id);
    writeHseAudit(db, { project_id: data.project_id, entity_type: 'incident', entity_id: id, action: 'create', before: null, after: created, actor });
    upsertNotification(newIncidentNotification(created));
    return created;
  });
  return run();
}

export function getIncidentById(id) {
  const row = hdb().prepare(`SELECT * FROM hse_incidents WHERE id = ?`).get(id);
  if (!row) return null;
  return { ...row, affected_persons: JSON.parse(row.affected_persons || '[]') };
}

export function listIncidents({ project_id, site_id, status, incident_type, from, to, page = 1, pageSize = 20 } = {}) {
  const db = hdb();
  let where = ' WHERE 1=1';
  const params = {};
  if (project_id) { where += ' AND project_id = @project_id'; params.project_id = project_id; }
  if (site_id) { where += ' AND site_id = @site_id'; params.site_id = site_id; }
  if (status) { where += ' AND status = @status'; params.status = status; }
  if (incident_type) { where += ' AND incident_type = @incident_type'; params.incident_type = incident_type; }
  if (from) { where += ' AND incident_date >= @from'; params.from = from; }
  if (to) { where += ' AND incident_date <= @to'; params.to = to; }
  const total = db.prepare(`SELECT COUNT(*) AS c FROM hse_incidents${where}`).get(params).c;
  const offset = (page - 1) * pageSize;
  const rows = db.prepare(`SELECT * FROM hse_incidents${where} ORDER BY incident_date DESC, id DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: pageSize, offset }).map((r) => ({ ...r, affected_persons: JSON.parse(r.affected_persons || '[]') }));
  return { rows, total, page, pageSize };
}

export function updateIncident(id, data, actor) {
  const db = hdb();
  const run = db.transaction(() => {
    const before = getIncidentById(id);
    if (!before) throw new ValidationError('الحادث غير موجود.');
    if (before.status === 'closed') throw new ValidationError('لا يمكن تعديل حادث مغلق.');
    const merged = { ...before, ...data };
    db.prepare(
      `UPDATE hse_incidents SET incident_type=@incident_type, incident_date=@incident_date, incident_time=@incident_time,
         location=@location, affected_persons=@affected_persons, description=@description, immediate_cause=@immediate_cause,
         root_cause=@root_cause, witnesses=@witnesses, damages_description=@damages_description, immediate_actions=@immediate_actions,
         site_id=@site_id, updated_at=datetime('now') WHERE id=@id`
    ).run({ id, incident_type: merged.incident_type, incident_date: merged.incident_date, incident_time: merged.incident_time,
      location: merged.location, affected_persons: JSON.stringify(merged.affected_persons || []), description: merged.description,
      immediate_cause: merged.immediate_cause, root_cause: merged.root_cause, witnesses: merged.witnesses,
      damages_description: merged.damages_description, immediate_actions: merged.immediate_actions, site_id: merged.site_id || null });
    const after = getIncidentById(id);
    writeHseAudit(db, { project_id: after.project_id, entity_type: 'incident', entity_id: id, action: 'update', before, after, actor });
    return after;
  });
  return run();
}

/** تحديث التحقيق - ينقل الحالة تلقائياً إلى investigating عند أول تحديث، ثم corrective_action
 * عند اكتمال التحقيق (البند 7: "التحقيق"، "الإجراءات التصحيحية"). */
export function updateInvestigation(id, { investigation_notes, investigation_status, root_cause, immediate_cause }, actor) {
  const db = hdb();
  const run = db.transaction(() => {
    const before = getIncidentById(id);
    if (!before) throw new ValidationError('الحادث غير موجود.');
    const nextStatus = investigation_status === 'completed' ? 'corrective_action' : 'investigating';
    db.prepare(
      `UPDATE hse_incidents SET investigation_notes=@investigation_notes, investigation_status=@investigation_status,
         root_cause=COALESCE(@root_cause, root_cause), immediate_cause=COALESCE(@immediate_cause, immediate_cause),
         status=@status, updated_at=datetime('now') WHERE id=@id`
    ).run({ id, investigation_notes: investigation_notes || before.investigation_notes,
      investigation_status: investigation_status || before.investigation_status,
      root_cause: root_cause || null, immediate_cause: immediate_cause || null, status: nextStatus });
    const after = getIncidentById(id);
    writeHseAudit(db, { project_id: after.project_id, entity_type: 'incident', entity_id: id, action: 'update_investigation', before, after, actor });
    return after;
  });
  return run();
}

/** ربط الحادث بسجل جودة/NCR حقيقي (البند 14) - إعادة استخدام مباشرة لـ createQualityRecord. */
export async function linkIncidentToQualityRecord(id, actor) {
  const db = hdb();
  const incident = getIncidentById(id);
  if (!incident) throw new ValidationError('الحادث غير موجود.');
  const { createQualityRecord } = await import('../../pm/db/quality.js');
  const record = createQualityRecord({
    project_id: incident.project_id, record_type: 'corrective_action',
    title: `NCR من حادث سلامة ${incident.incident_no}`,
    description: incident.description || null, result: incident.incident_type,
    record_date: incident.incident_date, status: 'open', actor,
  });
  db.prepare(`UPDATE hse_incidents SET linked_ncr_id = ?, updated_at = datetime('now') WHERE id = ?`).run(record.id, id);
  writeHseAudit(db, { project_id: incident.project_id, entity_type: 'incident', entity_id: id, action: 'link_ncr', before: incident, after: { linked_ncr_id: record.id }, actor });
  return getIncidentById(id);
}

/** الإغلاق - يتطلب انتهاء التحقيق فعلياً (investigation_status='completed') قبل السماح بالإغلاق. */
export function closeIncident(id, { closed_by }, actor) {
  const db = hdb();
  const run = db.transaction(() => {
    const before = getIncidentById(id);
    if (!before) throw new ValidationError('الحادث غير موجود.');
    if (before.investigation_status !== 'completed') throw new ValidationError('لا يمكن إغلاق الحادث قبل اكتمال التحقيق.');
    db.prepare(`UPDATE hse_incidents SET status='closed', closed_by=@closed_by, closed_at=datetime('now'), updated_at=datetime('now') WHERE id=@id`)
      .run({ id, closed_by: closed_by || actor || null });
    const after = getIncidentById(id);
    writeHseAudit(db, { project_id: after.project_id, entity_type: 'incident', entity_id: id, action: 'close', before, after, actor });
    return after;
  });
  return run();
}

export function deleteIncident(id, actor) {
  const db = hdb();
  const run = db.transaction(() => {
    const before = getIncidentById(id);
    if (!before) return { deleted: false };
    db.prepare(`DELETE FROM hse_incidents WHERE id = ?`).run(id);
    writeHseAudit(db, { project_id: before.project_id, entity_type: 'incident', entity_id: id, action: 'delete', before, after: null, actor });
    return { deleted: true };
  });
  return run();
}
