// lib/equipmentConstants.js — ثوابت الواجهة المشتركة بين مكونات قسم المعدات (قوائم منسدلة، تسميات).
export const EQUIPMENT_STATUS_OPTIONS = [
  { value: 'available', label: 'متاحة' }, { value: 'in_use', label: 'قيد التشغيل' },
  { value: 'maintenance', label: 'في الصيانة' }, { value: 'stopped', label: 'متوقفة' },
  { value: 'reserved', label: 'محجوزة' }, { value: 'out_of_service', label: 'خارج الخدمة' },
  { value: 'sold', label: 'مباعة' },
];

export const MAINTENANCE_TYPE_OPTIONS = [{ value: 'preventive', label: 'وقائية' }, { value: 'corrective', label: 'تصحيحية' }];

export const SEVERITY_OPTIONS = [
  { value: 'low', label: 'منخفضة' }, { value: 'medium', label: 'متوسطة' },
  { value: 'high', label: 'عالية' }, { value: 'critical', label: 'حرجة' },
];

export const INSPECTION_TYPE_OPTIONS = [{ value: 'pre_operation', label: 'فحص قبل التشغيل' }, { value: 'periodic', label: 'فحص دوري' }];
export const INSPECTION_RESULT_OPTIONS = [{ value: 'pass', label: 'ناجح' }, { value: 'pass_with_notes', label: 'ناجح مع ملاحظات' }, { value: 'fail', label: 'راسب' }];

export const INTERVAL_TYPE_OPTIONS = [{ value: 'hours', label: 'حسب ساعات التشغيل' }, { value: 'days', label: 'حسب عدد الأيام' }];

export const DOCUMENT_TYPE_OPTIONS = [
  { value: 'photo', label: 'صورة' }, { value: 'manual', label: 'دليل تشغيل' },
  { value: 'warranty', label: 'ضمان' }, { value: 'insurance', label: 'تأمين' }, { value: 'other', label: 'أخرى' },
];
