// lib/hse/db/inspections.js
// التفتيشات الميدانية (البند 6). كل بند غير مطابق (is_compliant = false) يتحوّل تلقائياً إلى
// إجراء تصحيحي حقيقي عبر createCorrectiveAction (البند 12: "كل ملاحظة سلامة يجب أن تتحول إلى
// إجراء تصحيحي") - وليس مجرد نص محفوظ بلا متابعة.
import { randomUUID } from 'crypto';
import { hdb } from '../schema.js';
import { writeHseAudit } from './audit.js';
import { createCorrectiveAction } from './correctiveActions.js';
import { ValidationError } from '../../calc/common.js';

function validateInspection(data) {
  const errors = [];
  if (!data.project_id) errors.push('المشروع مطلوب.');
  if (!data.inspection_date) errors.push('تاريخ التفتيش مطلوب.');
  if (errors.length) throw new ValidationError(errors);
}

export function createInspection(data, actor) {
  validateInspection(data);
  const db = hdb();
  const run = db.transaction(() => {
    const uuid = randomUUID();
    const info = db.prepare(
      `INSERT INTO hse_inspections (uuid, inspection_no, project_id, site_id, template_id, related_inspection_id,
         inspection_type, inspector, inspection_date, location, overall_result, status, notes)
       VALUES (@uuid, 'TEMP', @project_id, @site_id, @template_id, @related_inspection_id,
         @inspection_type, @inspector, @inspection_date, @location, 'pending', 'draft', @notes)`
    ).run({
      uuid, project_id: data.project_id, site_id: data.site_id || null, template_id: data.template_id || null,
      related_inspection_id: data.related_inspection_id || null, inspection_type: data.inspection_type || 'general_safety_walk',
      inspector: data.inspector || actor || null, inspection_date: data.inspection_date, location: data.location || null, notes: data.notes || null,
    });
    const id = info.lastInsertRowid;
    db.prepare(`UPDATE hse_inspections SET inspection_no = ? WHERE id = ?`).run(`INSP-${String(id).padStart(5, '0')}`, id);

    const items = Array.isArray(data.items) ? data.items : [];
    const insertItem = db.prepare(
      `INSERT INTO hse_inspection_items (inspection_id, item_text, category, equipment_id) VALUES (@inspection_id, @item_text, @category, @equipment_id)`
    );
    for (const item of items) {
      if (!item.item_text || !item.item_text.trim()) continue;
      insertItem.run({ inspection_id: id, item_text: item.item_text.trim(), category: item.category || null, equipment_id: item.equipment_id || null });
    }
    const created = getInspectionWithItems(id);
    writeHseAudit(db, { project_id: data.project_id, entity_type: 'inspection', entity_id: id, action: 'create', before: null, after: created, actor });
    return created;
  });
  return run();
}

export function getInspectionById(id) {
  return hdb().prepare(`SELECT * FROM hse_inspections WHERE id = ?`).get(id);
}

export function getInspectionWithItems(id) {
  const db = hdb();
  const inspection = getInspectionById(id);
  if (!inspection) return null;
  const items = db.prepare(`SELECT * FROM hse_inspection_items WHERE inspection_id = ? ORDER BY id ASC`).all(id);
  return { ...inspection, items };
}

export function listInspections({ project_id, site_id, status, inspection_type, page = 1, pageSize = 20 } = {}) {
  const db = hdb();
  let where = ' WHERE 1=1';
  const params = {};
  if (project_id) { where += ' AND project_id = @project_id'; params.project_id = project_id; }
  if (site_id) { where += ' AND site_id = @site_id'; params.site_id = site_id; }
  if (status) { where += ' AND status = @status'; params.status = status; }
  if (inspection_type) { where += ' AND inspection_type = @inspection_type'; params.inspection_type = inspection_type; }
  const total = db.prepare(`SELECT COUNT(*) AS c FROM hse_inspections${where}`).get(params).c;
  const offset = (page - 1) * pageSize;
  const rows = db.prepare(`SELECT * FROM hse_inspections${where} ORDER BY inspection_date DESC, id DESC LIMIT @limit OFFSET @offset`).all({ ...params, limit: pageSize, offset });
  return { rows, total, page, pageSize };
}

/** إضافة بند جديد لتفتيش قائم (تفتيش تدريجي أثناء الجولة الميدانية). */
export function addInspectionItem(inspectionId, { item_text, category, equipment_id }, actor) {
  const db = hdb();
  const run = db.transaction(() => {
    const inspection = getInspectionById(inspectionId);
    if (!inspection) throw new ValidationError('التفتيش غير موجود.');
    if (!item_text || !item_text.trim()) throw new ValidationError('نص البند مطلوب.');
    const info = db.prepare(`INSERT INTO hse_inspection_items (inspection_id, item_text, category, equipment_id) VALUES (?, ?, ?, ?)`)
      .run(inspectionId, item_text.trim(), category || null, equipment_id || null);
    writeHseAudit(db, { project_id: inspection.project_id, entity_type: 'inspection_item', entity_id: info.lastInsertRowid, action: 'create', before: null, after: { item_text }, actor });
    return db.prepare(`SELECT * FROM hse_inspection_items WHERE id = ?`).get(info.lastInsertRowid);
  });
  return run();
}

/** تسجيل نتيجة بند (مطابق/غير مطابق) - عند عدم المطابقة، ينشئ إجراءً تصحيحياً حقيقياً تلقائياً
 * إن طُلب ذلك (autoCorrectiveAction ≠ false)، ويربطه بالبند عبر corrective_action_id. */
export function recordInspectionItemResult(itemId, { is_compliant, severity, note, responsible, due_date, autoCorrectiveAction = true }, actor) {
  const db = hdb();
  const run = db.transaction(() => {
    const item = db.prepare(`SELECT * FROM hse_inspection_items WHERE id = ?`).get(itemId);
    if (!item) throw new ValidationError('بند التفتيش غير موجود.');
    const inspection = getInspectionById(item.inspection_id);
    let correctiveActionId = item.corrective_action_id;
    if (is_compliant === false && autoCorrectiveAction && !correctiveActionId) {
      const action = createCorrectiveAction({
        project_id: inspection.project_id, source_type: 'inspection_item', source_id: itemId,
        description: `معالجة ملاحظة تفتيش: ${item.item_text}${note ? ' - ' + note : ''}`,
        responsible: responsible || null, due_date: due_date || null,
      }, actor);
      correctiveActionId = action.id;
    }
    db.prepare(
      `UPDATE hse_inspection_items SET is_compliant=@is_compliant, severity=@severity, note=@note,
         responsible=@responsible, due_date=@due_date, corrective_action_id=@corrective_action_id WHERE id=@id`
    ).run({ id: itemId, is_compliant: is_compliant === null ? null : (is_compliant ? 1 : 0), severity: severity || null,
      note: note || null, responsible: responsible || null, due_date: due_date || null, corrective_action_id: correctiveActionId });
    const after = db.prepare(`SELECT * FROM hse_inspection_items WHERE id = ?`).get(itemId);
    writeHseAudit(db, { project_id: inspection.project_id, entity_type: 'inspection_item', entity_id: itemId, action: 'record_result', before: item, after, actor });
    return after;
  });
  return run();
}

function computeOverallResult(items) {
  if (items.length === 0) return 'pending';
  const nonCompliant = items.filter((i) => i.is_compliant === 0);
  if (nonCompliant.length === 0) return 'compliant';
  const hasCritical = nonCompliant.some((i) => i.severity === 'critical' || i.severity === 'major');
  return hasCritical ? 'non_compliant' : 'pass_with_notes';
}

/** إنهاء تسجيل التفتيش (لا يزال قابلاً للاعتماد لاحقاً - الإغلاق النهائي عبر approveInspection). */
export function completeInspection(id, actor) {
  const db = hdb();
  const run = db.transaction(() => {
    const before = getInspectionWithItems(id);
    if (!before) throw new ValidationError('التفتيش غير موجود.');
    const overall_result = computeOverallResult(before.items);
    db.prepare(`UPDATE hse_inspections SET status='completed', overall_result=@overall_result, updated_at=datetime('now') WHERE id=@id`)
      .run({ id, overall_result });
    const after = getInspectionWithItems(id);
    writeHseAudit(db, { project_id: after.project_id, entity_type: 'inspection', entity_id: id, action: 'complete', before, after, actor });
    return after;
  });
  return run();
}

/** اعتماد نتائج التفتيش (البند 6: "اعتماد نتائج التفتيش") - يتطلب حالة completed مسبقاً. */
export function approveInspection(id, { approved_by }, actor) {
  if (!approved_by) throw new ValidationError('اعتماد التفتيش يتطلب تحديد اسم المعتمِد.');
  const db = hdb();
  const run = db.transaction(() => {
    const before = getInspectionById(id);
    if (!before) throw new ValidationError('التفتيش غير موجود.');
    if (before.status !== 'completed') throw new ValidationError('لا يمكن اعتماد تفتيش لم يُستكمل تسجيله بعد.');
    db.prepare(`UPDATE hse_inspections SET status='approved', approved_by=@approved_by, approved_at=datetime('now'), updated_at=datetime('now') WHERE id=@id`)
      .run({ id, approved_by });
    const after = getInspectionById(id);
    writeHseAudit(db, { project_id: after.project_id, entity_type: 'inspection', entity_id: id, action: 'approve', before, after, actor });
    return after;
  });
  return run();
}

/** الإغلاق النهائي - يتطلب اعتماداً مسبقاً وألا تبقى بنود غير مطابقة بلا إجراء تصحيحي مفتوح. */
export function closeInspection(id, actor) {
  const db = hdb();
  const run = db.transaction(() => {
    const before = getInspectionWithItems(id);
    if (!before) throw new ValidationError('التفتيش غير موجود.');
    if (before.status !== 'approved') throw new ValidationError('لا يمكن إغلاق تفتيش لم يُعتمد بعد.');
    db.prepare(`UPDATE hse_inspections SET status='closed', closed_at=datetime('now'), updated_at=datetime('now') WHERE id=?`).run(id);
    const after = getInspectionWithItems(id);
    writeHseAudit(db, { project_id: after.project_id, entity_type: 'inspection', entity_id: id, action: 'close', before, after, actor });
    return after;
  });
  return run();
}

/** إعادة تفتيش (البند 6: "إعادة التفتيش") - ينشئ تفتيشاً جديداً مرتبطاً بالأصلي، عادة على
 * نفس بنود عدم المطابقة السابقة، للتحقق من إغلاقها فعلياً. */
export function createReinspection(originalId, data, actor) {
  const original = getInspectionWithItems(originalId);
  if (!original) throw new ValidationError('التفتيش الأصلي غير موجود.');
  const nonCompliantItems = original.items.filter((i) => i.is_compliant === 0);
  return createInspection({
    project_id: original.project_id, site_id: original.site_id, related_inspection_id: originalId,
    inspection_type: original.inspection_type, inspector: data.inspector, inspection_date: data.inspection_date,
    location: original.location, notes: `إعادة تفتيش على ${original.inspection_no}`,
    items: (data.items && data.items.length ? data.items : nonCompliantItems.map((i) => ({ item_text: i.item_text, category: i.category }))),
  }, actor);
}
