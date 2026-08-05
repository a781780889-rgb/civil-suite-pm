// lib/equipment/fileStorage.js — تخزين ملفات حقيقي على القرص، بنفس نمط lib/business/fileStorage.js
// تماماً، منظّم حسب equipment_id (صور، أدلة تشغيل، مستندات ضمان/تأمين - البند 2: "المستندات، الصور").
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

const BASE_DIR = join(process.cwd(), 'data', 'equipment-uploads');

function equipmentDir(equipmentId) {
  const dir = join(BASE_DIR, String(equipmentId));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

/** يحفظ Buffer على القرص تحت data/equipment-uploads/<equipment_id>/<uuid>.<ext> ويُعيد المسار النسبي المُخزَّن في equipment_documents.file_path. */
export function saveEquipmentFile(equipmentId, originalName, buffer) {
  const dir = equipmentDir(equipmentId);
  const ext = (originalName.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const storedName = `${randomUUID()}${ext ? '.' + ext : ''}`;
  writeFileSync(join(dir, storedName), buffer);
  return join('equipment-uploads', String(equipmentId), storedName);
}

export function readEquipmentFile(relativePath) {
  return readFileSync(join(process.cwd(), 'data', relativePath));
}

export function deleteEquipmentFile(relativePath) {
  const full = join(process.cwd(), 'data', relativePath);
  if (existsSync(full)) unlinkSync(full);
}
