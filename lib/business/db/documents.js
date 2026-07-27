// lib/business/db/documents.js — مستندات مرتبطة بأي كيان تجاري (عميل/فرصة/عرض سعر/عقد/شريك).
import { randomUUID } from 'crypto';
import { bdb } from '../schema.js';
import { writeBizAudit } from './audit.js';
import { deleteBusinessFile } from '../fileStorage.js';

export function createDocumentRecord({ entity_type, entity_id, project_id, category, name, file_path, file_size, mime_type, notes, actor }) {
  const db = bdb();
  const run = db.transaction(() => {
    const uuid = randomUUID();
    const info = db
      .prepare(
        `INSERT INTO biz_documents (uuid, entity_type, entity_id, project_id, category, name, file_path, file_size, mime_type, status, uploaded_by, notes)
         VALUES (@uuid, @entity_type, @entity_id, @project_id, @category, @name, @file_path, @file_size, @mime_type, 'pending_approval', @uploaded_by, @notes)`
      )
      .run({ uuid, entity_type, entity_id, project_id: project_id || null, category: category || null, name, file_path, file_size: file_size || 0, mime_type: mime_type || null, uploaded_by: actor || null, notes: notes || null });
    const created = getDocumentById(info.lastInsertRowid);
    writeBizAudit(db, { entity_type: 'document', entity_id: created.id, action: 'upload', before: null, after: { name, entity_type, entity_id }, actor });
    return created;
  });
  return run();
}

export function getDocumentById(id) {
  return bdb().prepare(`SELECT * FROM biz_documents WHERE id = ?`).get(id);
}

export function listDocuments({ entity_type, entity_id }) {
  return bdb().prepare(`SELECT * FROM biz_documents WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC`).all(entity_type, entity_id);
}

export function decideDocumentApproval(id, { approved, actor }) {
  const db = bdb();
  const run = db.transaction(() => {
    const before = getDocumentById(id);
    if (!before) throw new Error('المستند غير موجود.');
    const status = approved ? 'approved' : 'rejected';
    db.prepare(`UPDATE biz_documents SET status=@status, approved_by=@approved_by, approved_at=datetime('now'), updated_at=datetime('now') WHERE id=@id`)
      .run({ id, status, approved_by: actor || null });
    const after = getDocumentById(id);
    writeBizAudit(db, { entity_type: 'document', entity_id: id, action: approved ? 'approve' : 'reject', before, after, actor });
    return after;
  });
  return run();
}

export function deleteDocument(id, actor) {
  const db = bdb();
  const run = db.transaction(() => {
    const before = getDocumentById(id);
    if (!before) return { deleted: false };
    writeBizAudit(db, { entity_type: 'document', entity_id: id, action: 'delete', before, after: null, actor });
    db.prepare(`DELETE FROM biz_documents WHERE id = ?`).run(id);
    try { deleteBusinessFile(before.file_path); } catch { /* الملف قد يكون حُذف يدوياً من القرص مسبقاً */ }
    return { deleted: true };
  });
  return run();
}
