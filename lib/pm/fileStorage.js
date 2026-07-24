// lib/pm/fileStorage.js
// =============================================================================
// تخزين فعلي لملفات المستندات على القرص (data/pm-uploads/<project_id>/<uuid>.<ext>) - وليس
// مجرد بيانات وصفية وهمية. القيد الشفاف الوحيد: هذا تخزين محلي على قرص الخادم فقط (لا يوجد
// تكامل تخزين سحابي/CDN في هذا التسليم)، لذا لا يصلح كحل نسخ احتياطي وحيد في بيئة إنتاج حقيقية
// بدون نسخ القرص نفسه احتياطياً - تماماً كملف SQLite نفسه في data/civil-suite.sqlite3.
// =============================================================================

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const UPLOADS_ROOT = path.join(/*turbopackIgnore: true*/ process.cwd(), 'data', 'pm-uploads');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function safeExt(fileName) {
  const ext = (fileName || '').split('.').pop();
  if (!ext || ext.length > 10 || !/^[a-zA-Z0-9]+$/.test(ext)) return 'bin';
  return ext.toLowerCase();
}

/** يحفظ ملفاً مرفوعاً (كائن File من FormData) فعلياً على القرص، ويُعيد مساراً نسبياً آمناً لتخزينه في قاعدة البيانات. */
export async function saveUploadedFile(projectId, file) {
  const dir = path.join(UPLOADS_ROOT, String(projectId));
  ensureDir(dir);
  const ext = safeExt(file.name);
  const storedName = `${randomUUID()}.${ext}`;
  const absolutePath = path.join(dir, storedName);
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(absolutePath, buffer);
  return {
    relativePath: path.join(String(projectId), storedName),
    size: buffer.length,
    mimeType: file.type || 'application/octet-stream',
    originalName: file.name || storedName,
  };
}

export function getAbsolutePath(relativePath) {
  return path.join(UPLOADS_ROOT, relativePath);
}

export function readFileBuffer(relativePath) {
  return fs.readFileSync(getAbsolutePath(relativePath));
}

export function deleteFile(relativePath) {
  try {
    fs.unlinkSync(getAbsolutePath(relativePath));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err; // نتجاهل فقط حالة عدم وجود الملف أصلاً
  }
}
