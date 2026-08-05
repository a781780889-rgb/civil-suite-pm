// lib/hse/db/safetyPlans.js
// خطط السلامة/السياسات/الإجراءات/خطط الإخلاء وخرائط السلامة (البند 1) - إعادة استخدام حقيقية
// وكاملة لنظام المستندات الموجود أصلاً (lib/pm/db/documents.js + lib/pm/fileStorage.js) بدل
// بناء نظام رفع/إصدارات/اعتماد مستندات مواز من الصفر. هذا الملف طبقة رقيقة فقط: يقيّد category
// على HSE_DOCUMENT_CATEGORIES ويمرّر البقية كما هي - "تحديث الإصدارات" و"الاعتماد" حقيقيان
// بالكامل لأنهما نفس آلية pm_documents/pm_document_versions المُختبرة فعلاً في القسم الرابع.
import { HSE_DOCUMENT_CATEGORIES } from '../schema.js';
import { saveUploadedFile } from '../../pm/fileStorage.js';
import {
  listDocuments, getDocument, listDocumentVersions, createDocument,
  addDocumentVersion, updateDocumentMeta, setDocumentApproval, deleteDocument,
} from '../../pm/db/documents.js';
import { ValidationError } from '../../calc/common.js';

function assertHseCategory(category) {
  if (!HSE_DOCUMENT_CATEGORIES.includes(category)) {
    throw new ValidationError(`تصنيف "${category}" ليس من تصنيفات خطط/مستندات السلامة (${HSE_DOCUMENT_CATEGORIES.join(', ')}).`);
  }
}

export async function createSafetyPlanDocument({ project_id, category, name, file, uploaded_by, notes }, actor) {
  assertHseCategory(category);
  if (!file) throw new ValidationError('الملف مطلوب.');
  const saved = await saveUploadedFile(project_id, file);
  return createDocument({
    project_id, category, name: name || saved.originalName, file_path: saved.relativePath,
    file_size: saved.size, mime_type: saved.mimeType, uploaded_by: uploaded_by || actor, notes, actor,
  });
}

export async function addSafetyPlanVersion(documentId, { file, uploaded_by, notes }, actor) {
  const doc = getDocument(documentId);
  if (!doc) throw new ValidationError('المستند غير موجود.');
  assertHseCategory(doc.category);
  if (!file) throw new ValidationError('الملف مطلوب.');
  const saved = await saveUploadedFile(doc.project_id, file);
  return addDocumentVersion(documentId, { file_path: saved.relativePath, file_size: saved.size, uploaded_by: uploaded_by || actor, notes, actor });
}

export function listSafetyPlanDocuments({ project_id, category } = {}) {
  const all = listDocuments({ project_id, category });
  return category ? all : all.filter((d) => HSE_DOCUMENT_CATEGORIES.includes(d.category));
}

export function getSafetyPlanDocument(id) {
  const doc = getDocument(id);
  if (!doc || !HSE_DOCUMENT_CATEGORIES.includes(doc.category)) return null;
  return { ...doc, versions: listDocumentVersions(id) };
}

export function approveSafetyPlanDocument(id, { approved, approved_by, notes }, actor) {
  const doc = getDocument(id);
  if (!doc) throw new ValidationError('المستند غير موجود.');
  assertHseCategory(doc.category);
  return setDocumentApproval(id, { approved, approved_by, notes, actor });
}

export function deleteSafetyPlanDocument(id, actor) {
  const doc = getDocument(id);
  if (!doc) return { deleted: false };
  assertHseCategory(doc.category);
  return deleteDocument(id, actor);
}

export { HSE_DOCUMENT_CATEGORIES };
