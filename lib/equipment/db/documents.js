// lib/equipment/db/documents.js
import { randomUUID } from 'crypto';
import { edb } from '../schema.js';
import { deleteEquipmentFile } from '../fileStorage.js';
import { writeAudit } from './audit.js';

export function createDocumentRecord({ equipment_id, doc_type, file_path, original_name, mime_type, size_bytes, uploaded_by }) {
  const db = edb();
  const uuid = randomUUID();
  db.prepare(`
    INSERT INTO equipment_documents (uuid, equipment_id, doc_type, file_path, original_name, mime_type, size_bytes, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uuid, equipment_id, doc_type || 'other', file_path, original_name || null, mime_type || null, size_bytes || null, uploaded_by || null);
  const doc = db.prepare(`SELECT * FROM equipment_documents WHERE uuid = ?`).get(uuid);
  writeAudit({ equipment_id, entity_type: 'document', entity_id: doc.id, action: 'upload', after: doc, actor: uploaded_by });
  return doc;
}

export function listDocuments(equipment_id) {
  return edb().prepare(`SELECT * FROM equipment_documents WHERE equipment_id = ? ORDER BY created_at DESC`).all(equipment_id);
}

export function getDocumentById(id) {
  return edb().prepare(`SELECT * FROM equipment_documents WHERE id = ?`).get(id);
}

export function deleteDocumentRecord(id, actor) {
  const db = edb();
  const doc = getDocumentById(id);
  if (!doc) throw new Error('المستند غير موجود.');
  deleteEquipmentFile(doc.file_path);
  db.prepare(`DELETE FROM equipment_documents WHERE id = ?`).run(id);
  writeAudit({ equipment_id: doc.equipment_id, entity_type: 'document', entity_id: id, action: 'delete', before: doc, actor });
  return { deleted: true };
}
