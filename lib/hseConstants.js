// lib/hseConstants.js — قوائم اختيار وتسميات عربية للقسم الثامن، بنفس نمط lib/equipmentConstants.js.
// القيم (value) تطابق حرفياً ثوابت lib/hse/schema.js حتى لا يتكرر تعريفها بصيغتين مختلفتين.

export const SITE_STATUS_OPTIONS = [
  { value: 'active', label: 'نشط' }, { value: 'suspended', label: 'موقوف' }, { value: 'closed', label: 'مغلق' },
];

export const RISK_CATEGORY_OPTIONS = [
  { value: 'fall', label: 'سقوط' }, { value: 'electrical', label: 'كهربائي' }, { value: 'fire', label: 'حريق' },
  { value: 'chemical', label: 'كيميائي' }, { value: 'mechanical', label: 'ميكانيكي' }, { value: 'ergonomic', label: 'بيئة عمل/إيرغونومي' },
  { value: 'environmental', label: 'بيئي' }, { value: 'vehicle_traffic', label: 'مركبات وحركة' }, { value: 'excavation', label: 'حفريات' },
  { value: 'lifting', label: 'رفع' }, { value: 'confined_space', label: 'أماكن مغلقة' }, { value: 'other', label: 'أخرى' },
];

export const RISK_LEVEL_OPTIONS = [
  { value: 'low', label: 'منخفض', color: '#1F8A56' }, { value: 'medium', label: 'متوسط', color: '#B8860B' },
  { value: 'high', label: 'مرتفع', color: '#D9581F' }, { value: 'critical', label: 'حرج', color: '#C0392B' },
];

export const RISK_STATUS_OPTIONS = [
  { value: 'open', label: 'مفتوح' }, { value: 'mitigating', label: 'قيد المعالجة' },
  { value: 'reassessed', label: 'أُعيد تقييمه' }, { value: 'closed', label: 'مغلق' },
];

export const PERMIT_TYPE_OPTIONS = [
  { value: 'working_at_height', label: 'العمل في الأماكن المرتفعة' }, { value: 'confined_space', label: 'العمل في الأماكن المغلقة' },
  { value: 'hot_work', label: 'أعمال اللحام والقطع' }, { value: 'electrical', label: 'الأعمال الكهربائية' },
  { value: 'excavation', label: 'أعمال الحفر' }, { value: 'lifting', label: 'أعمال الرفع' },
  { value: 'hazardous_materials', label: 'العمل بالمواد الخطرة' }, { value: 'maintenance', label: 'أعمال الصيانة' },
];

export const PERMIT_STATUS_OPTIONS = [
  { value: 'draft', label: 'مسودة' }, { value: 'pending_approval', label: 'بانتظار الاعتماد' }, { value: 'approved', label: 'معتمَد' },
  { value: 'active', label: 'نشط' }, { value: 'expired', label: 'منتهي' }, { value: 'closed', label: 'مغلق' },
  { value: 'rejected', label: 'مرفوض' }, { value: 'cancelled', label: 'ملغى' },
];

export const INSPECTION_TYPE_OPTIONS = [
  { value: 'general_safety_walk', label: 'جولة سلامة عامة' }, { value: 'scaffolding', label: 'سقالات' },
  { value: 'ppe_compliance', label: 'الالتزام بمعدات الوقاية' }, { value: 'housekeeping', label: 'تدبير منزلي/نظافة الموقع' },
  { value: 'fire_safety', label: 'سلامة الحريق' }, { value: 'electrical_safety', label: 'السلامة الكهربائية' },
  { value: 'excavation', label: 'الحفريات' }, { value: 'custom', label: 'مخصص' },
];

export const INSPECTION_RESULT_OPTIONS = [
  { value: 'pending', label: 'قيد التنفيذ' }, { value: 'compliant', label: 'مطابق' },
  { value: 'non_compliant', label: 'غير مطابق' }, { value: 'pass_with_notes', label: 'مطابق مع ملاحظات' },
];

export const FINDING_SEVERITY_OPTIONS = [
  { value: 'minor', label: 'بسيطة' }, { value: 'moderate', label: 'متوسطة' }, { value: 'major', label: 'كبيرة' }, { value: 'critical', label: 'حرجة' },
];

export const INCIDENT_TYPE_OPTIONS = [
  { value: 'fatality', label: 'وفاة' }, { value: 'lost_time_injury', label: 'إصابة تستدعي إيقاف عمل' },
  { value: 'medical_treatment_injury', label: 'إصابة تستدعي علاجاً طبياً' }, { value: 'first_aid_injury', label: 'إصابة إسعافات أولية' },
  { value: 'property_damage', label: 'أضرار ممتلكات' }, { value: 'environmental', label: 'بيئي' },
  { value: 'fire', label: 'حريق' }, { value: 'vehicle_accident', label: 'حادث مركبة' },
];

export const INJURY_SEVERITY_OPTIONS = [
  { value: 'minor', label: 'طفيفة' }, { value: 'moderate', label: 'متوسطة' }, { value: 'severe', label: 'جسيمة' }, { value: 'fatal', label: 'وفاة' },
];

export const INCIDENT_STATUS_OPTIONS = [
  { value: 'reported', label: 'مُبلَّغ عنه' }, { value: 'investigating', label: 'قيد التحقيق' },
  { value: 'corrective_action', label: 'إجراء تصحيحي' }, { value: 'closed', label: 'مغلق' },
];

export const VIOLATION_TYPE_OPTIONS = [
  { value: 'ppe_noncompliance', label: 'عدم التزام بمعدات الوقاية' }, { value: 'unsafe_act', label: 'تصرف غير آمن' },
  { value: 'unsafe_condition', label: 'حالة غير آمنة' }, { value: 'permit_violation', label: 'مخالفة تصريح عمل' },
  { value: 'housekeeping', label: 'تدبير منزلي' }, { value: 'environmental', label: 'بيئي' }, { value: 'other', label: 'أخرى' },
];

export const SEVERITY_OPTIONS = [
  { value: 'low', label: 'منخفضة' }, { value: 'medium', label: 'متوسطة' }, { value: 'high', label: 'عالية' }, { value: 'critical', label: 'حرجة' },
];

export const CORRECTIVE_ACTION_STATUS_OPTIONS = [
  { value: 'open', label: 'مفتوح' }, { value: 'in_progress', label: 'قيد التنفيذ' },
  { value: 'completed', label: 'مكتمل' }, { value: 'verified', label: 'تم التحقق' }, { value: 'closed', label: 'مغلق' },
];

export const PPE_TYPE_OPTIONS = [
  { value: 'helmet', label: 'خوذة' }, { value: 'safety_boots', label: 'أحذية سلامة' }, { value: 'gloves', label: 'قفازات' },
  { value: 'goggles', label: 'نظارات واقية' }, { value: 'safety_harness', label: 'حزام أمان' }, { value: 'reflective_vest', label: 'سترة عاكسة' },
  { value: 'respirator', label: 'جهاز تنفس' }, { value: 'ear_protection', label: 'واقي سمع' }, { value: 'protective_clothing', label: 'ملابس حماية' },
];

export const PPE_CONDITION_OPTIONS = [
  { value: 'good', label: 'جيدة' }, { value: 'damaged', label: 'تالفة' }, { value: 'expired', label: 'منتهية' }, { value: 'replaced', label: 'مُستبدَلة' },
];

export const HAZMAT_CATEGORY_OPTIONS = [
  { value: 'flammable', label: 'قابل للاشتعال' }, { value: 'corrosive', label: 'أكّال' }, { value: 'toxic', label: 'سام' },
  { value: 'reactive', label: 'تفاعلي' }, { value: 'oxidizing', label: 'مؤكسِد' }, { value: 'biohazard', label: 'خطر حيوي' },
  { value: 'radioactive', label: 'مشعّ' }, { value: 'other', label: 'أخرى' },
];

export const FIRE_EQUIPMENT_TYPE_OPTIONS = [
  { value: 'extinguisher', label: 'طفاية حريق' }, { value: 'hose_reel', label: 'خرطوم إطفاء' }, { value: 'alarm_system', label: 'نظام إنذار' },
  { value: 'smoke_detector', label: 'كاشف دخان' }, { value: 'emergency_exit', label: 'مخرج طوارئ' }, { value: 'sprinkler_system', label: 'نظام رش آلي' },
];

export const FIRE_EQUIPMENT_STATUS_OPTIONS = [
  { value: 'active', label: 'فعّال' }, { value: 'needs_service', label: 'يحتاج صيانة' },
  { value: 'expired', label: 'منتهي' }, { value: 'out_of_service', label: 'خارج الخدمة' },
];

export const EMERGENCY_PLAN_TYPE_OPTIONS = [
  { value: 'evacuation', label: 'إخلاء' }, { value: 'fire', label: 'حريق' }, { value: 'medical', label: 'طبي' },
  { value: 'chemical_spill', label: 'انسكاب كيميائي' }, { value: 'general', label: 'عام' },
];

export const EMERGENCY_TEAM_TYPE_OPTIONS = [
  { value: 'evacuation', label: 'فريق إخلاء' }, { value: 'first_aid', label: 'إسعافات أولية' },
  { value: 'firefighting', label: 'مكافحة حريق' }, { value: 'rescue', label: 'إنقاذ' }, { value: 'incident_command', label: 'قيادة الحوادث' },
];

export const HSE_DOCUMENT_CATEGORY_OPTIONS = [
  { value: 'hse_safety_plan', label: 'خطة السلامة' }, { value: 'hse_policy', label: 'سياسة سلامة' },
  { value: 'hse_procedure', label: 'إجراء سلامة' }, { value: 'hse_safe_work_instruction', label: 'تعليمات عمل آمن' },
  { value: 'hse_evacuation_plan', label: 'خطة إخلاء' }, { value: 'hse_safety_map', label: 'خريطة سلامة' },
];

export const HSE_REPORT_TYPE_OPTIONS = [
  { value: 'incidents', label: 'تقرير الحوادث والإصابات' }, { value: 'risks', label: 'تقرير المخاطر' },
  { value: 'inspections', label: 'تقرير التفتيشات' }, { value: 'permits', label: 'تقرير تصاريح العمل' },
  { value: 'near_miss', label: 'تقرير Near Miss' }, { value: 'violations', label: 'تقرير المخالفات' },
  { value: 'training', label: 'تقرير التدريب' }, { value: 'ppe', label: 'تقرير معدات الوقاية' },
  { value: 'kpis', label: 'تقرير مؤشرات الأداء' }, { value: 'executive', label: 'التقرير التنفيذي' },
];

export function optionLabel(options, value) {
  return options.find((o) => o.value === value)?.label || value || '-';
}
