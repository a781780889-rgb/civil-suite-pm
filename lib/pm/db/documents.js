// lib/pm/db/documents.js
import { randomUUID } from 'crypto';
import { pdb } from '../schema.js';
import { writePmAudit } from './audit.js';
import { upsertNotification } from './notifications.js';

export function listDocuments({ project_id, category, status } = {}) {
  const db = pdb();
  let where = ' WHERE 1=1';
  const params = {};
  if (project_id) { where += ' AND project_id = @project_id'; params.project_id = project_id; }
  if (category) { where += ' AND category = @category'; params.category = category; }
  if (status) { where += ' AND status = @status'; params.status = status; }
  return db.prepare(`SELECT * FROM pm_documents${where} ORDER BY updated_at DESC`).all(params);
}

export function getDocument(id) {
  return pdb().prepare(`SELECT * FROM pm_documents WHERE id = ?`).get(id);
}

export function listDocumentVersions(documentId) {
  return pdb().prepare(`SELECT * FROM pm_document_versions WHERE document_id = ? ORDER BY version DESC`).all(documentId);
}

/** يُنشئ سجل مستند جديد (الإصدار الأول) - يُستدعى بعد أن يحفظ fileStorage.js الملف فعلياً على القرص. */
export function createDocument({ project_id, category, name, file_path, file_size, mime_type, uploaded_by, notes, actor }) {
  const db = pdb();
  const run = db.transaction(() => {
    const uuid = randomUUID();
    const info = db
      .prepare(
        `INSERT INTO pm_documents (uuid, project_id, category, name, file_path, file_size, mime_type, version, status, uploaded_by, notes)
         VALUES (@uuid, @project_id, @category, @name, @file_path, @file_size, @mime_type, 1, 'pending_approval', @uploaded_by, @notes)`
      )
      .run({ uuid, project_id, category: category || null, name, file_path, file_size: file_size || 0, mime_type: mime_type || null, uploaded_by: uploaded_by || null, notes: notes || null });
    const created = getDocument(info.lastInsertRowid);
    db.prepare(`INSERT INTO pm_document_versions (document_id, version, file_path, file_size, uploaded_by, notes) VALUES (?, 1, ?, ?, ?, ?)`)
      .run(created.id, file_path, file_size || 0, uploaded_by || null, 'الإصدار الأول');
    writePmAudit(db, { project_id, entity_type: 'document', entity_id: created.id, action: 'create', before: null, after: created, actor });
    upsertNotification({
      project_id, type: 'document_added', severity: 'info',
      title: `مستند جديد: ${name}`,
      message: `تمت إضافة مستند جديد${category ? ' في تصنيف ' + category : ''}.`,
      related_entity_type: 'document', related_entity_id: created.id,
      dedup_key: `document_added:${created.id}`,
    });
    return created;
  });
  return run();
}

/** يضيف إصداراً جديداً لملف موجود - الملف الجديد محفوظ فعلياً على القرص مسبقاً بواسطة fileStorage.js. */
export function addDocumentVersion(documentId, { file_path, file_size, uploaded_by, notes, actor }) {
  const db = pdb();
  const run = db.transaction(() => {
    const before = getDocument(documentId);
    if (!before) throw new Error('المستند غير موجود.');
    const newVersion = before.version + 1;
    db.prepare(`INSERT INTO pm_document_versions (document_id, version, file_path, file_size, uploaded_by, notes) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(documentId, newVersion, file_path, file_size || 0, uploaded_by || null, notes || null);
    db.prepare(
      `UPDATE pm_documents SET file_path=@file_path, file_size=@file_size, version=@version, status='pending_approval',
         approved_by=NULL, approved_at=NULL, updated_at=datetime('now') WHERE id=@id`
    ).run({ id: documentId, file_path, file_size: file_size || 0, version: newVersion });
    const after = getDocument(documentId);
    writePmAudit(db, { project_id: after.project_id, entity_type: 'document', entity_id: documentId, action: 'new_version', before, after, actor });
    return after;
  });
  return run();
}

export function updateDocumentMeta(id, data) {
  const db = pdb();
  const run = db.transaction(() => {
    const before = getDocument(id);
    if (!before) throw new Error('المستند غير موجود.');
    const merged = { ...before, ...data };
    db.prepare(`UPDATE pm_documents SET category=@category, name=@name, notes=@notes, updated_at=datetime('now') WHERE id=@id`)
      .run({ id, category: merged.category || null, name: merged.name, notes: merged.notes || null });
    const after = getDocument(id);
    writePmAudit(db, { project_id: after.project_id, entity_type: 'document', entity_id: id, action: 'update', before, after, actor: data.actor });
    return after;
  });
  return run();
}

export function setDocumentApproval(id, { approved, approved_by, notes, actor }) {
  const db = pdb();
  const run = db.transaction(() => {
    const before = getDocument(id);
    if (!before) throw new Error('المستند غير موجود.');
    db.prepare(
      `UPDATE pm_documents SET status=@status, approved_by=@approved_by, approved_at=@approved_at, notes=@notes, updated_at=datetime('now') WHERE id=@id`
    ).run({
      id, status: approved ? 'approved' : 'rejected', approved_by: approved_by || null,
      approved_at: approved ? new Date().toISOString() : null, notes: notes ?? before.notes,
    });
    const after = getDocument(id);
    writePmAudit(db, { project_id: after.project_id, entity_type: 'document', entity_id: id, action: approved ? 'approve' : 'reject', before, after, actor });
    return after;
  });
  return run();
}

/** يُعيد المستند وكل مساراته الفعلية على القرص (كل الإصدارات) قبل الحذف - المسار الفعلي للحذف الفعلي من fileStorage.js يتم في طبقة الـ API. */
export function deleteDocument(id, actor) {
  const db = pdb();
  const run = db.transaction(() => {
    const before = getDocument(id);
    if (!before) return { deleted: false, filePaths: [] };
    const versions = listDocumentVersions(id);
    const filePaths = [...new Set([before.file_path, ...versions.map((v) => v.file_path)])];
    db.prepare(`DELETE FROM pm_documents WHERE id = ?`).run(id); // CASCADE يحذف pm_document_versions تلقائياً
    writePmAudit(db, { project_id: before.project_id, entity_type: 'document', entity_id: id, action: 'delete', before, after: null, actor });
    return { deleted: true, filePaths };
  });
  return run();
}
