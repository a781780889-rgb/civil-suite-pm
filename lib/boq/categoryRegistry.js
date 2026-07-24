// lib/boq/categoryRegistry.js
// =============================================================================
// سجل أصناف حصر الكميات - يغطي التخصصات الأربعة عشر المطلوبة في مواصفة القسم الثالث
// (أعمال ترابية، خرسانة، حديد تسليح، مباني، لياسة، عزل، أرضيات، أسقف، دهانات، نجارة،
// ألمنيوم وزجاج، كهرباء، صحي، طرق) بنحو 80 صنفاً، كل صنف مربوط بدالة حساب هندسية حقيقية
// واحدة من lib/boq/primitives.js (بلا أي معامل تقريبي أو رقم جاهز).
//
// هذا السجل هو أيضاً "هيكل هرمي واضح" لتصنيف العناصر (تخصص ← صنف) كما تشترط قواعد القسم،
// وهو قابل للتوسّع: أي صنف يضيفه المستخدم من واجهة "أصناف مخصّصة" يُحفظ بنفس الشكل تماماً
// في جدول boq_categories (عبر upsertBoqCategory في lib/db.js) ويعمل فوراً مع نفس المحرك.
// =============================================================================

export const TRADES = {
  earthwork: { label_ar: 'أعمال الترابية', order: 1 },
  concrete: { label_ar: 'الخرسانة', order: 2 },
  rebar: { label_ar: 'حديد التسليح', order: 3 },
  masonry: { label_ar: 'المباني', order: 4 },
  plaster: { label_ar: 'اللياسة', order: 5 },
  insulation: { label_ar: 'العزل', order: 6 },
  flooring: { label_ar: 'الأرضيات', order: 7 },
  ceiling: { label_ar: 'الأسقف (تشطيبات)', order: 8 },
  paint: { label_ar: 'الدهانات', order: 9 },
  carpentry: { label_ar: 'النجارة', order: 10 },
  aluminum_glass: { label_ar: 'الألمنيوم والزجاج', order: 11 },
  electrical: { label_ar: 'الأعمال الكهربائية', order: 12 },
  plumbing: { label_ar: 'الأعمال الصحية', order: 13 },
  roads: { label_ar: 'أعمال الطرق', order: 14 },
};

// ---------------------------------------------------------------------------
// دوال مساعدة لبناء تعريفات الحقول دون تكرار (كل عنصر واجهة يبقى مربوطاً بمفتاح موحّد
// يطابق اسم المعامل في lib/boq/primitives.js - فقط التسمية المعروضة تتغيّر حسب الصنف)
// ---------------------------------------------------------------------------
const F = {
  length: (label = 'الطول') => ({ key: 'lengthM', label, unit: 'm', type: 'number', required: true }),
  width: (label = 'العرض') => ({ key: 'widthM', label, unit: 'm', type: 'number', required: true }),
  height: (label = 'الارتفاع') => ({ key: 'heightM', label, unit: 'm', type: 'number', required: true }),
  diameter: (label = 'القطر') => ({ key: 'diameterM', label, unit: 'm', type: 'number', required: true }),
  area: (label = 'المساحة (بديل عن الطول والعرض)') => ({ key: 'areaM2', label, unit: 'm2', type: 'number', required: false }),
  thickness: (label = 'السماكة') => ({ key: 'thicknessM', label, unit: 'm', type: 'number', required: true }),
  openings: () => ({ key: 'openingsAreaM2', label: 'مساحة الفتحات (تُخصم)', unit: 'm2', type: 'number', required: false, default: 0 }),
  count: (label = 'عدد العناصر المتطابقة') => ({ key: 'count', label, unit: 'عدد', type: 'number', required: false, default: 1 }),
  segments: (label = 'عدد القطع/الخطوط') => ({ key: 'segments', label, unit: 'عدد', type: 'number', required: false, default: 1 }),
  countField: (label = 'العدد') => ({ key: 'count', label, unit: 'عدد', type: 'number', required: true }),
  quantityManual: (unitLabel) => ({ key: 'quantityManual', label: `الكمية (${unitLabel})`, type: 'number', required: true }),
  waste: (def = 5) => ({ key: 'wastePct', label: 'نسبة الهدر', unit: '%', type: 'number', required: false, default: def }),
};

const BOX = (waste = 5) => [F.length(), F.width(), F.height(), F.count(), F.waste(waste)];
const LAYER = (heightLabel = 'السماكة', waste = 10) => [F.area('المساحة المسقطة'), F.thickness(heightLabel), F.waste(waste)];
const AREA = (waste = 5) => [F.area(), F.length('الطول (إن لم تُدخل المساحة)'), F.width('العرض/الارتفاع (إن لم تُدخل المساحة)'), F.openings(), F.count('عدد الطبقات/الأوجه'), F.waste(waste)];
const LEN = (waste = 5) => [F.length(), F.segments(), F.waste(waste)];
const CNT = () => [F.countField()];

// حقول خاصة بالخرسانة فقط (تُستهلك في lib/boq/calcElement.js عبر calculateConcreteMaterials
// من القسم الأول - نفس محرك حصر مواد الخرسانة، وليس نسخة مبسّطة جديدة منه)
F.grade = () => ({ key: 'grade', label: 'مقاومة الخرسانة (Grade)', type: 'select', required: false, default: 'C25', options: [
  { value: 'C20', label: 'C20 - عناصر إنشائية خفيفة' },
  { value: 'C25', label: 'C25 - عناصر إنشائية عامة' },
  { value: 'C30', label: 'C30 - أعمدة/كمرات/قواعد رئيسية' },
  { value: 'C35', label: 'C35 - عناصر معرضة لبيئة قاسية' },
  { value: 'C40', label: 'C40 - خزانات/منشآت خاصة' },
] });
F.cementType = () => ({ key: 'cementType', label: 'نوع الأسمنت', type: 'select', required: false, default: 'OPC', options: [
  { value: 'OPC', label: 'أسمنت بورتلاندي عادي (OPC)' },
  { value: 'SRC', label: 'أسمنت مقاوم للكبريتات (SRC)' },
  { value: 'PPC', label: 'أسمنت بوزولاني (PPC)' },
] });
F.linkedCalc = (prefix) => ({ key: 'linkedCalculationId', label: prefix === 'rebar_' ? 'ربط بحساب حديد محفوظ (القسم الثاني)' : 'ربط بحساب إنشائي محفوظ (القسم الأول)', type: 'linked_calculation', calc_type_prefix: prefix, required: false });

const CONCRETE_BOX = (waste = 5) => [...BOX(waste), F.grade(), F.cementType()];
const CONCRETE_LAYER = (heightLabel, waste) => [...LAYER(heightLabel, waste), F.grade(), F.cementType()];
const CONCRETE_CYLINDER = (heightLabel = 'الارتفاع', waste = 5) => [F.diameter(), F.height(heightLabel), F.count(), F.waste(waste), F.grade(), F.cementType()];

/**
 * كل عنصر: key فريد، trade، calc_method (يطابق أحد مفاتيح PRIMITIVES في primitives.js أو
 * 'concrete_with_materials' / 'rebar_link' الخاصّين)، unit الوحدة المخرجة، fields حقول الإدخال.
 * geometryMethod: للخرسانة فقط - يحدد أي primitive هندسي يُستخدم قبل حساب مواد الخرسانة.
 */
export const CATEGORIES = [
  // ==================== أعمال الترابية ====================
  { key: 'earthwork_excavation', trade: 'earthwork', name_ar: 'الحفر', calc_method: 'layer_volume', unit: 'm3', default_waste_pct: 10, fields: LAYER('عمق الحفر', 10) },
  { key: 'earthwork_backfill', trade: 'earthwork', name_ar: 'الردم', calc_method: 'layer_volume', unit: 'm3', default_waste_pct: 15, fields: LAYER('سماكة الردم', 15) },
  { key: 'earthwork_replacement', trade: 'earthwork', name_ar: 'الإحلال', calc_method: 'layer_volume', unit: 'm3', default_waste_pct: 10, fields: LAYER('سماكة الإحلال', 10) },
  { key: 'earthwork_fill', trade: 'earthwork', name_ar: 'الدفان', calc_method: 'layer_volume', unit: 'm3', default_waste_pct: 15, fields: LAYER('سماكة الدفان', 15) },
  { key: 'earthwork_compaction', trade: 'earthwork', name_ar: 'الدك', calc_method: 'area_minus_openings', unit: 'm2', default_waste_pct: 0, fields: AREA(0) },
  { key: 'earthwork_debris_removal', trade: 'earthwork', name_ar: 'نقل المخلفات', calc_method: 'manual_quantity', unit: 'm3', default_waste_pct: 0, fields: [F.quantityManual('م³')] },

  // ==================== الخرسانة (يدعم الربط بحاسبة القسم الأول - انظر resolveBoqQuantity) ====================
  { key: 'concrete_lean', trade: 'concrete', name_ar: 'خرسانة نظافة', calc_method: 'concrete_with_materials', geometry_method: 'layer_volume', unit: 'm3', default_waste_pct: 5, fields: CONCRETE_LAYER('السماكة', 5), s1_calc_types: [] },
  { key: 'concrete_isolated_footing', trade: 'concrete', name_ar: 'القواعد المنفصلة', calc_method: 'concrete_with_materials', geometry_method: 'box_volume', unit: 'm3', default_waste_pct: 5, fields: [...CONCRETE_BOX(5), F.linkedCalc('')], s1_calc_types: ['isolated_footing'] },
  { key: 'concrete_combined_footing', trade: 'concrete', name_ar: 'القواعد المشتركة', calc_method: 'concrete_with_materials', geometry_method: 'box_volume', unit: 'm3', default_waste_pct: 5, fields: [...CONCRETE_BOX(5), F.linkedCalc('')], s1_calc_types: ['combined_footing', 'strap_footing'] },
  { key: 'concrete_mat', trade: 'concrete', name_ar: 'اللبشة', calc_method: 'concrete_with_materials', geometry_method: 'layer_volume', unit: 'm3', default_waste_pct: 5, fields: [...CONCRETE_LAYER('سماكة اللبشة', 5), F.linkedCalc('')], s1_calc_types: ['mat_foundation'] },
  { key: 'concrete_tie_beam', trade: 'concrete', name_ar: 'الميدات', calc_method: 'concrete_with_materials', geometry_method: 'box_volume', unit: 'm3', default_waste_pct: 5, fields: CONCRETE_BOX(5), s1_calc_types: [] },
  { key: 'concrete_column_rect', trade: 'concrete', name_ar: 'الأعمدة (مستطيلة)', calc_method: 'concrete_with_materials', geometry_method: 'box_volume', unit: 'm3', default_waste_pct: 5, fields: [...CONCRETE_BOX(5), F.linkedCalc('')], s1_calc_types: ['column'] },
  { key: 'concrete_column_round', trade: 'concrete', name_ar: 'الأعمدة (دائرية)', calc_method: 'concrete_with_materials', geometry_method: 'cylinder_volume', unit: 'm3', default_waste_pct: 5, fields: [...CONCRETE_CYLINDER(), F.linkedCalc('')], s1_calc_types: ['column'] },
  { key: 'concrete_beam', trade: 'concrete', name_ar: 'الكمرات', calc_method: 'concrete_with_materials', geometry_method: 'box_volume', unit: 'm3', default_waste_pct: 5, fields: [...CONCRETE_BOX(5), F.linkedCalc('')], s1_calc_types: ['beam'] },
  { key: 'concrete_slab', trade: 'concrete', name_ar: 'البلاطات', calc_method: 'concrete_with_materials', geometry_method: 'layer_volume', unit: 'm3', default_waste_pct: 5, fields: [...CONCRETE_LAYER('سماكة البلاطة', 5), F.linkedCalc('')], s1_calc_types: ['one_way_slab', 'two_way_slab'] },
  { key: 'concrete_wall', trade: 'concrete', name_ar: 'الجدران الخرسانية', calc_method: 'concrete_with_materials', geometry_method: 'box_volume', unit: 'm3', default_waste_pct: 5, fields: [F.length(), F.height(), F.width('السماكة'), F.count(), F.waste(5), F.grade(), F.cementType(), F.linkedCalc('')], s1_calc_types: ['wall'] },
  { key: 'concrete_stairs', trade: 'concrete', name_ar: 'السلالم', calc_method: 'concrete_with_materials', geometry_method: 'box_volume', unit: 'm3', default_waste_pct: 5, fields: [...CONCRETE_BOX(5), F.linkedCalc('')], s1_calc_types: ['stairs'] },
  { key: 'concrete_roof_slab', trade: 'concrete', name_ar: 'الأسقف (بلاطة روف)', calc_method: 'concrete_with_materials', geometry_method: 'layer_volume', unit: 'm3', default_waste_pct: 5, fields: [...CONCRETE_LAYER('سماكة البلاطة', 5), F.linkedCalc('')], s1_calc_types: ['one_way_slab', 'two_way_slab'] },
  { key: 'concrete_tank_rect', trade: 'concrete', name_ar: 'الخزانات (مستطيلة)', calc_method: 'concrete_with_materials', geometry_method: 'box_volume', unit: 'm3', default_waste_pct: 5, fields: [...CONCRETE_BOX(5), F.linkedCalc('')], s1_calc_types: ['tank'] },
  { key: 'concrete_tank_round', trade: 'concrete', name_ar: 'الخزانات (دائرية)', calc_method: 'concrete_with_materials', geometry_method: 'cylinder_volume', unit: 'm3', default_waste_pct: 5, fields: [...CONCRETE_CYLINDER(), F.linkedCalc('')], s1_calc_types: ['tank'] },
  { key: 'concrete_pool', trade: 'concrete', name_ar: 'المسابح', calc_method: 'concrete_with_materials', geometry_method: 'box_volume', unit: 'm3', default_waste_pct: 5, fields: [...CONCRETE_BOX(5), F.linkedCalc('')], s1_calc_types: ['pool'] },
  { key: 'concrete_pile_cap', trade: 'concrete', name_ar: 'قبعات الخوازيق', calc_method: 'concrete_with_materials', geometry_method: 'box_volume', unit: 'm3', default_waste_pct: 5, fields: CONCRETE_BOX(5), s1_calc_types: ['isolated_footing'] },
  { key: 'concrete_pile', trade: 'concrete', name_ar: 'الخوازيق', calc_method: 'concrete_with_materials', geometry_method: 'cylinder_volume', unit: 'm3', default_waste_pct: 5, fields: CONCRETE_CYLINDER('الطول'), s1_calc_types: [] },

  // ==================== حديد التسليح (ربط إلزامي بحاسبة القسم الثاني أو إدخال يدوي موثّق) ====================
  { key: 'rebar_detailed', trade: 'rebar', name_ar: 'حديد تسليح مُفصَّل (BBS)', calc_method: 'rebar_link', unit: 'kg', default_waste_pct: 0, fields: [F.linkedCalc('rebar_'), F.quantityManual('كغم - إن لم يوجد ربط')] },
  { key: 'rebar_mesh_sheets', trade: 'rebar', name_ar: 'شبك حديد جاهز (فرد)', calc_method: 'count_total', unit: 'ea', default_waste_pct: 5, fields: CNT() },


  // ==================== المباني ====================
  { key: 'masonry_red_brick', trade: 'masonry', name_ar: 'الطوب الأحمر', calc_method: 'area_minus_openings', unit: 'm2', default_waste_pct: 5, fields: AREA(5) },
  { key: 'masonry_block', trade: 'masonry', name_ar: 'البلوك', calc_method: 'area_minus_openings', unit: 'm2', default_waste_pct: 5, fields: AREA(5) },
  { key: 'masonry_cement_brick', trade: 'masonry', name_ar: 'الطوب الأسمنتي', calc_method: 'area_minus_openings', unit: 'm2', default_waste_pct: 5, fields: AREA(5) },
  { key: 'masonry_stone', trade: 'masonry', name_ar: 'الحجر', calc_method: 'area_minus_openings', unit: 'm2', default_waste_pct: 7, fields: AREA(7) },
  { key: 'masonry_aerated_concrete', trade: 'masonry', name_ar: 'الخرسانة الخلوية', calc_method: 'area_minus_openings', unit: 'm2', default_waste_pct: 5, fields: AREA(5) },

  // ==================== اللياسة ====================
  { key: 'plaster_internal_cement', trade: 'plaster', name_ar: 'لياسة داخلية إسمنتية', calc_method: 'area_minus_openings', unit: 'm2', default_waste_pct: 8, fields: AREA(8) },
  { key: 'plaster_external_cement', trade: 'plaster', name_ar: 'لياسة خارجية إسمنتية', calc_method: 'area_minus_openings', unit: 'm2', default_waste_pct: 8, fields: AREA(8) },
  { key: 'plaster_internal_gypsum', trade: 'plaster', name_ar: 'لياسة داخلية جبسية', calc_method: 'area_minus_openings', unit: 'm2', default_waste_pct: 6, fields: AREA(6) },
  { key: 'plaster_external_gypsum', trade: 'plaster', name_ar: 'لياسة خارجية جبسية', calc_method: 'area_minus_openings', unit: 'm2', default_waste_pct: 6, fields: AREA(6) },

  // ==================== العزل ====================
  { key: 'insulation_waterproofing', trade: 'insulation', name_ar: 'العزل المائي', calc_method: 'area_minus_openings', unit: 'm2', default_waste_pct: 10, fields: AREA(10) },
  { key: 'insulation_thermal', trade: 'insulation', name_ar: 'العزل الحراري', calc_method: 'area_minus_openings', unit: 'm2', default_waste_pct: 8, fields: AREA(8) },
  { key: 'insulation_roof', trade: 'insulation', name_ar: 'عزل الأسطح', calc_method: 'area_minus_openings', unit: 'm2', default_waste_pct: 10, fields: AREA(10) },
  { key: 'insulation_tank', trade: 'insulation', name_ar: 'عزل الخزانات', calc_method: 'area_minus_openings', unit: 'm2', default_waste_pct: 10, fields: AREA(10) },
  { key: 'insulation_bathroom', trade: 'insulation', name_ar: 'عزل الحمامات', calc_method: 'area_minus_openings', unit: 'm2', default_waste_pct: 12, fields: AREA(12) },

  // ==================== الأرضيات ====================
  { key: 'flooring_ceramic', trade: 'flooring', name_ar: 'السيراميك', calc_method: 'area_minus_openings', unit: 'm2', default_waste_pct: 10, fields: AREA(10) },
  { key: 'flooring_porcelain', trade: 'flooring', name_ar: 'البورسلان', calc_method: 'area_minus_openings', unit: 'm2', default_waste_pct: 10, fields: AREA(10) },
  { key: 'flooring_marble', trade: 'flooring', name_ar: 'الرخام', calc_method: 'area_minus_openings', unit: 'm2', default_waste_pct: 12, fields: AREA(12) },
  { key: 'flooring_granite', trade: 'flooring', name_ar: 'الجرانيت', calc_method: 'area_minus_openings', unit: 'm2', default_waste_pct: 12, fields: AREA(12) },
  { key: 'flooring_epoxy', trade: 'flooring', name_ar: 'الإيبوكسي', calc_method: 'area_minus_openings', unit: 'm2', default_waste_pct: 5, fields: AREA(5) },
  { key: 'flooring_parquet', trade: 'flooring', name_ar: 'الباركيه', calc_method: 'area_minus_openings', unit: 'm2', default_waste_pct: 8, fields: AREA(8) },
  { key: 'flooring_stamped_concrete', trade: 'flooring', name_ar: 'الخرسانة المطبوعة', calc_method: 'area_minus_openings', unit: 'm2', default_waste_pct: 5, fields: AREA(5) },

  // ==================== الأسقف (تشطيبات) ====================
  { key: 'ceiling_gypsum_board', trade: 'ceiling', name_ar: 'أسقف الجبس', calc_method: 'area_minus_openings', unit: 'm2', default_waste_pct: 8, fields: AREA(8) },
  { key: 'ceiling_metal', trade: 'ceiling', name_ar: 'الأسقف المعدنية', calc_method: 'area_minus_openings', unit: 'm2', default_waste_pct: 6, fields: AREA(6) },
  { key: 'ceiling_suspended', trade: 'ceiling', name_ar: 'الأسقف المستعارة', calc_method: 'area_minus_openings', unit: 'm2', default_waste_pct: 6, fields: AREA(6) },

  // ==================== الدهانات ====================
  { key: 'paint_internal', trade: 'paint', name_ar: 'دهانات داخلية', calc_method: 'area_minus_openings', unit: 'm2', default_waste_pct: 5, fields: [F.area(), F.length('الطول (إن لم تُدخل المساحة)'), F.width('العرض/الارتفاع (إن لم تُدخل المساحة)'), F.openings(), F.count('عدد الطبقات'), F.waste(5)] },
  { key: 'paint_external', trade: 'paint', name_ar: 'دهانات خارجية', calc_method: 'area_minus_openings', unit: 'm2', default_waste_pct: 7, fields: [F.area(), F.length('الطول (إن لم تُدخل المساحة)'), F.width('العرض/الارتفاع (إن لم تُدخل المساحة)'), F.openings(), F.count('عدد الطبقات'), F.waste(7)] },
  { key: 'paint_putty', trade: 'paint', name_ar: 'معجون', calc_method: 'area_minus_openings', unit: 'm2', default_waste_pct: 5, fields: AREA(5) },
  { key: 'paint_primer', trade: 'paint', name_ar: 'برايمر', calc_method: 'area_minus_openings', unit: 'm2', default_waste_pct: 5, fields: AREA(5) },
  { key: 'paint_finish_coat', trade: 'paint', name_ar: 'طبقات التشطيب', calc_method: 'area_minus_openings', unit: 'm2', default_waste_pct: 5, fields: [F.area(), F.length('الطول (إن لم تُدخل المساحة)'), F.width('العرض/الارتفاع (إن لم تُدخل المساحة)'), F.openings(), F.count('عدد الطبقات'), F.waste(5)] },

  // ==================== النجارة ====================
  { key: 'carpentry_doors', trade: 'carpentry', name_ar: 'الأبواب', calc_method: 'count_total', unit: 'ea', default_waste_pct: 0, fields: CNT() },
  { key: 'carpentry_windows', trade: 'carpentry', name_ar: 'الشبابيك (خشب)', calc_method: 'count_total', unit: 'ea', default_waste_pct: 0, fields: CNT() },
  { key: 'carpentry_kitchens', trade: 'carpentry', name_ar: 'المطابخ', calc_method: 'length_total', unit: 'm', default_waste_pct: 3, fields: LEN(3) },
  { key: 'carpentry_cabinets', trade: 'carpentry', name_ar: 'الخزائن', calc_method: 'length_total', unit: 'm', default_waste_pct: 3, fields: LEN(3) },

  // ==================== الألمنيوم والزجاج ====================
  { key: 'alumglass_facades', trade: 'aluminum_glass', name_ar: 'الواجهات', calc_method: 'area_minus_openings', unit: 'm2', default_waste_pct: 5, fields: AREA(5) },
  { key: 'alumglass_windows', trade: 'aluminum_glass', name_ar: 'الشبابيك (ألمنيوم)', calc_method: 'area_minus_openings', unit: 'm2', default_waste_pct: 5, fields: AREA(5) },
  { key: 'alumglass_doors', trade: 'aluminum_glass', name_ar: 'الأبواب (ألمنيوم)', calc_method: 'area_minus_openings', unit: 'm2', default_waste_pct: 5, fields: AREA(5) },
  { key: 'alumglass_domes', trade: 'aluminum_glass', name_ar: 'القبب الزجاجية', calc_method: 'count_total', unit: 'ea', default_waste_pct: 0, fields: CNT() },

  // ==================== الأعمال الكهربائية ====================
  { key: 'electrical_cables', trade: 'electrical', name_ar: 'الكابلات', calc_method: 'length_total', unit: 'm', default_waste_pct: 8, fields: LEN(8) },
  { key: 'electrical_conduits', trade: 'electrical', name_ar: 'المواسير', calc_method: 'length_total', unit: 'm', default_waste_pct: 8, fields: LEN(8) },
  { key: 'electrical_panels', trade: 'electrical', name_ar: 'اللوحات', calc_method: 'count_total', unit: 'ea', default_waste_pct: 0, fields: CNT() },
  { key: 'electrical_switches', trade: 'electrical', name_ar: 'المفاتيح والمخارج', calc_method: 'count_total', unit: 'ea', default_waste_pct: 3, fields: CNT() },
  { key: 'electrical_lighting', trade: 'electrical', name_ar: 'الإنارة', calc_method: 'count_total', unit: 'ea', default_waste_pct: 3, fields: CNT() },
  { key: 'electrical_grounding', trade: 'electrical', name_ar: 'التأريض', calc_method: 'count_total', unit: 'ea', default_waste_pct: 0, fields: CNT() },
  { key: 'electrical_fire_alarm', trade: 'electrical', name_ar: 'أنظمة الحريق', calc_method: 'count_total', unit: 'ea', default_waste_pct: 0, fields: CNT() },

  // ==================== الأعمال الصحية ====================
  { key: 'plumbing_water_supply', trade: 'plumbing', name_ar: 'مواسير المياه', calc_method: 'length_total', unit: 'm', default_waste_pct: 8, fields: LEN(8) },
  { key: 'plumbing_drainage', trade: 'plumbing', name_ar: 'مواسير الصرف', calc_method: 'length_total', unit: 'm', default_waste_pct: 8, fields: LEN(8) },
  { key: 'plumbing_ventilation', trade: 'plumbing', name_ar: 'التهوية', calc_method: 'length_total', unit: 'm', default_waste_pct: 8, fields: LEN(8) },
  { key: 'plumbing_pumps', trade: 'plumbing', name_ar: 'المضخات', calc_method: 'count_total', unit: 'ea', default_waste_pct: 0, fields: CNT() },
  { key: 'plumbing_tanks', trade: 'plumbing', name_ar: 'الخزانات (تمديدات)', calc_method: 'count_total', unit: 'ea', default_waste_pct: 0, fields: CNT() },

  // ==================== أعمال الطرق ====================
  { key: 'roads_subbase_layer', trade: 'roads', name_ar: 'طبقة الردم', calc_method: 'layer_volume', unit: 'm3', default_waste_pct: 10, fields: LAYER('سماكة الطبقة', 10) },
  { key: 'roads_base_layer', trade: 'roads', name_ar: 'طبقة الأساس', calc_method: 'layer_volume', unit: 'm3', default_waste_pct: 10, fields: LAYER('سماكة الطبقة', 10) },
  { key: 'roads_asphalt_layer', trade: 'roads', name_ar: 'طبقة الأسفلت', calc_method: 'layer_volume', unit: 'm3', default_waste_pct: 5, fields: LAYER('سماكة الطبقة', 5) },
  { key: 'roads_sidewalks', trade: 'roads', name_ar: 'الأرصفة', calc_method: 'area_minus_openings', unit: 'm2', default_waste_pct: 8, fields: AREA(8) },
  { key: 'roads_curbs', trade: 'roads', name_ar: 'البردورات', calc_method: 'length_total', unit: 'm', default_waste_pct: 5, fields: LEN(5) },
  { key: 'roads_marking', trade: 'roads', name_ar: 'الدهانات الأرضية', calc_method: 'length_total', unit: 'm', default_waste_pct: 5, fields: LEN(5) },
];

export function getCategory(key) {
  return CATEGORIES.find((c) => c.key === key) || null;
}

export function listCategoriesByTrade() {
  const byTrade = {};
  for (const trade of Object.keys(TRADES)) byTrade[trade] = [];
  for (const cat of CATEGORIES) {
    if (!byTrade[cat.trade]) byTrade[cat.trade] = [];
    byTrade[cat.trade].push(cat);
  }
  return byTrade;
}

export function assertUniqueKeys() {
  const seen = new Set();
  for (const c of CATEGORIES) {
    if (seen.has(c.key)) throw new Error(`مفتاح صنف مكرر في السجل: ${c.key}`);
    seen.add(c.key);
  }
  return true;
}
