// lib/hse/db/attachments.js
// صور/فيديوهات/مرفقات الحوادث والتفتيش وبطاقات SDS (البند 7: "الصور، الفيديوهات، المرفقات").
// تخزين فعلي على القرص عبر lib/pm/fileStorage.js المُعاد استخدامه حرفياً (نفس آلية pm_documents)
// - وليس Base64 وهمي في القاعدة. جدول واحد متعدد الأشكال (entity_type/entity_id) يخدم كل
// كيانات القسم الثامن بدل عمود ملف مكرر في كل جدول (نفس مبدأ hse_corrective_actions).
import { hdb, ATTACHMENT_ENTITY_TYPES } from '../schema.js';
import { saveUploadedFile, deleteFile } from '../../pm/fileStorage.js';
import { writeHseAudit } from './audit.js';
import { ValidationError } from '../../calc/common.js';

export async function addAttachment({ project_id, entity_type, entity_id, file, uploaded_by }, actor) {
  if (!ATTACHMENT_ENTITY_TYPES.includes(entity_type)) throw new ValidationError(`نوع الكيان "${entity_type}" غير مدعوم للمرفقات.`);
  if (!file || typeof file === 'string') throw new ValidationError('الملف مطلوب.');
  const saved = await saveUploadedFile(project_id, file);
  const db = hdb();
  const info = db.prepare(
    `INSERT INTO hse_attachments (entity_type, entity_id, file_path, file_size, mime_type, original_name, uploaded_by)
     VALUES (@entity_type, @entity_id, @file_path, @file_size, @mime_type, @original_name, @uploaded_by)`
  ).run({ entity_type, entity_id, file_path: saved.relativePath, file_size: saved.size, mime_type: saved.mimeType, original_name: saved.originalName, uploaded_by: uploaded_by || null });
  const created = db.prepare(`SELECT * FROM hse_attachments WHERE id = ?`).get(info.lastInsertRowid);
  writeHseAudit(db, { project_id, entity_type: 'attachment', entity_id: created.id, action: 'create', before: null, after: created, actor });
  return created;
}

export function listAttachments(entity_type, entity_id) {
  return hdb().prepare(`SELECT * FROM hse_attachments WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC`).all(entity_type, entity_id);
}

export function getAttachmentById(id) {
  return hdb().prepare(`SELECT * FROM hse_attachments WHERE id = ?`).get(id);
}

export function deleteAttachment(id, actor) {
  const db = hdb();
  const run = db.transaction(() => {
    const before = getAttachmentById(id);
    if (!before) return { deleted: false };
    db.prepare(`DELETE FROM hse_attachments WHERE id = ?`).run(id);
    writeHseAudit(db, { project_id: null, entity_type: 'attachment', entity_id: id, action: 'delete', before, after: null, actor });
    return { deleted: true, filePath: before.file_path };
  });
  const result = run();
  if (result.deleted) deleteFile(result.filePath); // الحذف الفعلي من القرص بعد نجاح حذف السجل
  return result;
}
