// lib/equipment/db/categories.js
// تصنيف المعدات (البند 3) - مجموعة افتراضية مزروعة عبر schema.js + إمكانية إضافة تصنيفات
// مخصصة من لوحة التحكم ("مع إمكانية إضافة تصنيفات جديدة من لوحة التحكم").
import { edb } from '../schema.js';
import { ValidationError } from '../../calc/common.js';

const GROUP_LABELS = {
  drilling: 'معدات الحفر', lifting: 'معدات الرفع', concrete: 'معدات الخرسانة',
  roads: 'معدات الطرق', transport: 'معدات النقل', power: 'معدات الكهرباء والطاقة',
  workshop: 'معدات الورش', safety: 'معدات السلامة',
};

export function listCategories({ group_key } = {}) {
  const db = edb();
  const where = group_key ? 'WHERE group_key = @group_key' : '';
  return db.prepare(`SELECT * FROM equipment_categories ${where} ORDER BY group_key, name_ar`).all({ group_key });
}

export function listCategoryGroups() {
  return Object.entries(GROUP_LABELS).map(([key, label_ar]) => ({ key, label_ar }));
}

export function createCategory({ key, group_key, name_ar }) {
  if (!key || !group_key || !name_ar) {
    throw new ValidationError('بيانات التصنيف غير مكتملة.', ['المفتاح والمجموعة والاسم كلها مطلوبة.']);
  }
  if (!GROUP_LABELS[group_key]) {
    throw new ValidationError('مجموعة التصنيف غير معروفة.', [`المجموعات المتاحة: ${Object.keys(GROUP_LABELS).join('، ')}.`]);
  }
  const db = edb();
  const slug = String(key).trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
  const exists = db.prepare(`SELECT id FROM equipment_categories WHERE key = ?`).get(slug);
  if (exists) throw new ValidationError('مفتاح التصنيف مستخدم مسبقاً.', [`"${slug}" موجود بالفعل.`]);
  db.prepare(`INSERT INTO equipment_categories (key, group_key, group_label_ar, name_ar, is_custom) VALUES (?, ?, ?, ?, 1)`)
    .run(slug, group_key, GROUP_LABELS[group_key], name_ar);
  return db.prepare(`SELECT * FROM equipment_categories WHERE key = ?`).get(slug);
}

export function deleteCategory(key) {
  const db = edb();
  const inUse = db.prepare(`SELECT COUNT(*) AS n FROM equipment_assets WHERE category_key = ?`).get(key).n;
  if (inUse > 0) {
    throw new ValidationError('لا يمكن حذف تصنيف مستخدم.', [`يوجد ${inUse} معدة مرتبطة بهذا التصنيف.`]);
  }
  const row = db.prepare(`SELECT * FROM equipment_categories WHERE key = ?`).get(key);
  if (!row) throw new Error('التصنيف غير موجود.');
  if (!row.is_custom) throw new ValidationError('لا يمكن حذف تصنيف افتراضي.', ['التصنيفات الافتراضية جزء أساسي من النظام.']);
  db.prepare(`DELETE FROM equipment_categories WHERE key = ?`).run(key);
  return { deleted: true };
}
