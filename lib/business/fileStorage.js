// lib/business/fileStorage.js — تخزين ملفات حقيقي على القرص، بنفس نمط lib/pm/fileStorage.js
// تماماً لكن منظّم بحسب نوع الكيان ومعرّفه (entity_type/entity_id) بدل project_id فقط، لأن
// مستندات القسم السادس تُرفع على عميل/عرض سعر/عقد/شريك قبل أن يوجد بالضرورة مشروع تنفيذي.
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

const BASE_DIR = join(process.cwd(), 'data', 'business-uploads');

function entityDir(entityType, entityId) {
  const dir = join(BASE_DIR, entityType, String(entityId));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

/** يحفظ Buffer على القرص تحت data/business-uploads/<entity_type>/<entity_id>/<uuid>.<ext> ويُعيد المسار النسبي المُخزَّن في biz_documents.file_path. */
export function saveBusinessFile(entityType, entityId, originalName, buffer) {
  const dir = entityDir(entityType, entityId);
  const ext = (originalName.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const storedName = `${randomUUID()}${ext ? '.' + ext : ''}`;
  writeFileSync(join(dir, storedName), buffer);
  return join('business-uploads', entityType, String(entityId), storedName);
}

export function readBusinessFile(relativePath) {
  return readFileSync(join(process.cwd(), 'data', relativePath));
}

export function deleteBusinessFile(relativePath) {
  const full = join(process.cwd(), 'data', relativePath);
  if (existsSync(full)) unlinkSync(full);
}
