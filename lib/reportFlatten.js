// lib/reportFlatten.js
// يحوّل أي كائن نتائج (results) من محركات الحساب إلى قائمة أقسام/صفوف جاهزة للعرض في
// تقرير PDF، بحيث تظهر كل قيمة محسوبة فعلياً (بلا استثناء) مع تسمية عربية واضحة.

const SECTION_LABELS = {
  loads: 'الأحمال',
  soil: 'بيانات التربة',
  soilPressure: 'ضغط التربة',
  geometry: 'الأبعاد الهندسية',
  shear: 'فحص القص',
  flexure: 'التصميم على الانحناء',
  design: 'التصميم',
  quantities: 'الكميات',
  materials: 'مواد الخرسانة',
  cost: 'التكلفة',
  deflection: 'فحص الترخيم',
  reactions: 'ردود الأفعال',
  strapShear: 'قص جسر الربط',
  strapBeam: 'جسر الربط (Strap Beam)',
  edgeFooting: 'القاعدة الحافية',
  interiorFooting: 'القاعدة الداخلية',
  eccentricity: 'اللامركزية',
  punchingShear: 'القص الثاقب',
  typicalSpans: 'الأبحاث النمطية',
  directionX: 'الاتجاه X',
  directionY: 'الاتجاه Y',
  shortDirection: 'الاتجاه القصير',
  longDirection: 'الاتجاه الطويل',
  loadSharing: 'توزيع الحمل بين الاتجاهين',
  minimumReinforcement: 'التسليح الأدنى',
  retainingDesign: 'تصميم الجدار الاستنادي',
  slenderness: 'فحص النحافة',
  hoopTension: 'شد الطوق (Hoop Tension)',
  verticalBending: 'الانحناء الرأسي',
  roof: 'السقف',
  volumes: 'الأحجام',
  areas: 'المساحات',
  finishes: 'التشطيبات',
  pump: 'المضخة والفلتر',
  excavation: 'أعمال الحفر',
  wallDesign: 'تصميم الجدار',
  upliftCheck: 'فحص الرفع (Uplift)',
  centralColumn: 'العمود المركزي',
  landing: 'البسطة',
};

const FIELD_LABELS = {
  deadLoadKN: 'الحمل الميت D', liveLoadKN: 'الحمل الحي L', Pservice: 'الحمل الخدمي', Pu: 'الحمل المصعّد',
  PserviceKN: 'الحمل الخدمي', PuKN: 'الحمل المصعّد', totalServiceKN: 'إجمالي الحمل الخدمي', totalFactoredKN: 'إجمالي الحمل المصعّد',
  netAllowableKPa: 'قدرة التحمل الصافية', providedPressureServiceKPa: 'الضغط الفعلي (خدمي)',
  lengthM: 'الطول', widthM: 'العرض', overallDepthMm: 'السماكة الكلية', effectiveDepthMm: 'العمق الفعال d',
  areaM2: 'المساحة', quKPa: 'ضغط التربة المصمم (مصعّد)',
  MuL_kNm_per_m: 'العزم باتجاه L (لكل م)', MuB_kNm_per_m: 'العزم باتجاه B (لكل م)',
  reinforcementDirectionL: 'تسليح الاتجاه L', reinforcementDirectionB: 'تسليح الاتجاه B',
  concreteVolumeM3: 'حجم الخرسانة', steelWeightKg: 'وزن حديد التسليح',
  b0Mm: 'محيط القص الثاقب b0', betaC: 'معامل βc', alphaS: 'معامل αs', VcKN: 'مقاومة القص Vc', phiVcKN: 'φVc', VuKN: 'قوة القص Vu', governing: 'المعادلة الحاكمة',
  wKNm: 'حمل التربة الموزّع w', VmaxKN: 'أقصى قوة قص',
  MmaxPositiveKNm: 'أقصى عزم موجب', MmaxNegativeKNm: 'أقصى عزم سالب',
  positiveMomentLocationM: 'موقع العزم الموجب', negativeMomentLocationM: 'موقع العزم السالب',
  reinforcementBottom: 'التسليح السفلي', reinforcementTop: 'التسليح العلوي', reinforcementTransverse: 'التسليح العرضي',
  widthMm: 'العرض', depthMm: 'العمق', heightM: 'الارتفاع', AgMm2: 'مساحة المقطع الكلية Ag',
  tieType: 'نوع الكانات', AstReqMm2: 'مساحة الحديد المطلوبة Ast', rhoReq: 'نسبة التسليح المطلوبة %',
  phiPnActualKN: 'القدرة المحورية الفعلية φPn', utilizationRatio: 'نسبة الاستغلال', reinforcement: 'التسليح الطولي', ties: 'الكانات',
  spanM: 'البحر', supportType: 'حالة الإسناد', selfWeightKNm: 'الوزن الذاتي', totalDeadKNm: 'إجمالي الحمل الميت', wuKNm: 'الحمل المصعّد الموزّع',
  momentFormula: 'معادلة العزم المستخدمة', MuPosKNm: 'العزم الموجب', MuNegKNm: 'العزم السالب',
  reinforcementPos: 'التسليح السفلي', reinforcementNeg: 'التسليح العلوي', reinforcementShear: 'تسليح القص (كانات)',
  minHeightMm: 'الحد الأدنى للسماكة', providedHeightMm: 'السماكة المستخدمة', providedThicknessMm: 'السماكة المستخدمة', ok: 'مطابق؟',
  thicknessMm: 'السماكة', edgeCondition: 'حالة الإسناد',
  MposKNm_per_m: 'العزم الموجب (لكل م)', MnegKNm_per_m: 'العزم السالب (لكل م)',
  reinforcementMainPos: 'التسليح الرئيسي السفلي', reinforcementMainNeg: 'التسليح الرئيسي العلوي', reinforcementDistribution: 'تسليح التوزيع',
  VuKN_per_m: 'قوة القص (لكل م)', phiVcKN_per_m: 'مقاومة القص (لكل م)',
  shortSpanM: 'البحر القصير', longSpanM: 'البحر الطويل', aspectRatio: 'نسبة الأبعاد',
  wShortKPa: 'حمل الاتجاه القصير', wLongKPa: 'حمل الاتجاه الطويل',
  rhoVerticalMinPct: 'نسبة التسليح الرأسي الأدنى %', rhoHorizontalMinPct: 'نسبة التسليح الأفقي الأدنى %',
  reinforcementVertical: 'التسليح الرأسي', reinforcementHorizontal: 'التسليح الأفقي',
  Ka: 'معامل الضغط النشط Ka', loadFactor: 'معامل التحميل', MuBaseKNm_per_m: 'العزم عند القاعدة (لكل م)', VuBaseKN_per_m: 'القص عند القاعدة (لكل م)',
  note: 'ملاحظة', matLengthM: 'طول اللبشة', matWidthM: 'عرض اللبشة',
  exM: 'اللامركزية باتجاه X', eyM: 'اللامركزية باتجاه Y',
  qServiceMaxKPa: 'أقصى ضغط تربة (خدمي)', qServiceMinKPa: 'أدنى ضغط تربة (خدمي)', qFactoredAvgKPa: 'متوسط الضغط المصعّد',
  atColumn: 'عند العمود', demandFactoredKN: 'الحمل المصعّد المطلوب',
  spacingXM: 'التباعد النمطي X', spacingYM: 'التباعد النمطي Y',
  stairType: 'نوع الدرج', totalHeightM: 'الارتفاع الكلي', totalRisers: 'عدد القوائم', riserMm: 'ارتفاع القائمة', treadMm: 'عرض النائمة', comfortFormula: 'معادلة الراحة',
  angleDeg: 'زاوية الميل', inclinedLengthM: 'طول القلبة (مائل)', goingM: 'طول المسقط الأفقي', riseM: 'الارتفاع الرأسي', nRisers: 'عدد القوائم', nTreads: 'عدد النائمات',
  reinforcementMain: 'التسليح الرئيسي', formworkAreaM2: 'مساحة الشدة الخشبية',
  innerRadiusM: 'نصف القطر الداخلي', outerRadiusM: 'نصف القطر الخارجي', totalAngleDeg: 'الزاوية الكلية',
  walkLineTreadMm: 'عرض النائمة عند خط السير', walkLineRadiusM: 'نصف قطر خط السير', cantileverLengthM: 'طول الكابولي',
  diameterM: 'القطر', phiPnMaxKN: 'أقصى قدرة محورية φPnmax',
  stepVolumeM3: 'حجم الدرجة الواحدة', allStepsVolumeM3: 'حجم جميع الدرجات', columnVolumeM3: 'حجم العمود المركزي',
  waterHeightM: 'ارتفاع المياه التصميمي', freeboardM: 'الفريبورد', wallThicknessMm: 'سماكة الجدار', baseThicknessMm: 'سماكة القاعدة',
  radiusM: 'نصف القطر', TmaxKN_per_m: 'أقصى شد طوقي (لكل م)', AsRequiredMm2PerM: 'مساحة الحديد المطلوبة (لكل م)', reinforcementHoop: 'التسليح الطوقي',
  MedgeKNm_per_m: 'عزم الحافة (لكل م)', McenterKNm_per_m: 'عزم المنتصف (لكل م)', reinforcementEdge: 'تسليح الحافة', reinforcementCenter: 'تسليح المنتصف',
  wallVolumeM3: 'حجم الجدران', baseVolumeM3: 'حجم القاعدة', internalSurfaceWallM2: 'المساحة الداخلية للجدار', baseAreaM2: 'مساحة القاعدة', externalWallM2: 'المساحة الخارجية للجدار',
  waterproofingAreaM2: 'مساحة العزل المائي', internalPlasterAreaM2: 'مساحة اللياسة الداخلية', externalPlasterAreaM2: 'مساحة اللياسة الخارجية', storageCapacityM3: 'السعة التخزينية',
  poolShape: 'شكل المسبح', belowGrade: 'تحت منسوب الأرض؟', shallowDepthM: 'العمق الضحل', deepDepthM: 'العمق العميق', avgDepthM: 'متوسط العمق', maxDepthM: 'أقصى عمق', planAreaM2: 'مساحة المسقط', perimeterM: 'المحيط',
  excavAreaM2: 'مساحة الحفر', excavationVolumeM3: 'حجم الحفر', workingSpaceM: 'مسافة العمل الجانبية',
  governingCase: 'الحالة الحاكمة', MuFullPoolKNm_per_m: 'عزم حالة الامتلاء (لكل م)', MuEmptyPoolKNm_per_m: 'عزم حالة الفراغ (لكل م)',
  upliftForceKN: 'قوة الرفع', structureWeightKN: 'وزن المنشأ', safe: 'آمن؟',
  tilingAreaM2: 'مساحة التبليط', plasteringAreaM2: 'مساحة اللياسة',
  turnoverHours: 'مدة دورة التنقية', poolVolumeM3: 'حجم مياه المسبح', requiredFlowRateM3PerHr: 'التدفق المطلوب', requiredFlowRateLPM: 'التدفق (لتر/دقيقة)', requiredFlowRateGPM: 'التدفق (GPM)',
  gradeLabel: 'رتبة الخرسانة', ratioLabel: 'نسبة الخلط', wcRatio: 'نسبة الماء/الأسمنت', cementTypeLabel: 'نوع الأسمنت', wasteRatioPct: 'نسبة الهدر %',
  netVolumeM3: 'الحجم الصافي', grossVolumeM3: 'الحجم شاملاً الهدر', cementWeightKg: 'وزن الأسمنت', cementWeightTon: 'وزن الأسمنت (طن)',
  sandWeightKg: 'وزن الرمل', sandWeightTon: 'وزن الرمل (طن)', gravelWeightKg: 'وزن البحص', gravelWeightTon: 'وزن البحص (طن)',
  cementBags: 'عدد أكياس الأسمنت', waterLiters: 'كمية الماء (لتر)', cementContentPerM3: 'محتوى الأسمنت لكل م³',
  mixerLoads: 'عدد دفعات الخلاطة', truckTrips: 'عدد رحلات النقل', totalMaterialCost: 'إجمالي تكلفة المواد',
  methodology: 'المنهجية المستخدمة',
};

function labelFor(key) {
  return FIELD_LABELS[key] || key;
}

function formatValue(key, val) {
  if (typeof val === 'boolean') return val ? 'نعم' : 'لا';
  if (val == null || val === '') return '—';
  if (typeof val === 'number') {
    return Number.isInteger(val) ? val.toLocaleString('en-US') : val.toLocaleString('en-US', { maximumFractionDigits: 3 });
  }
  return String(val);
}

const SKIP_KEYS = new Set(['type', 'diagram', 'xs', 'shearKN', 'momentKNm', 'unitPrices', 'cornerValuesServiceKPa', 'inputsEcho', 'slabDesign', 'flights']);

/**
 * يحوّل كائن نتائج إلى مصفوفة أقسام: [{ title, rows: [{label, value}] }]
 * يُستخدم فقط في تقرير PDF (عرض شامل لكل شيء)، وليس في واجهة الشاشة (التي تُبنى يدوياً لأفضل تجربة استخدام)
 */
export function flattenResultsForReport(results, depth = 0, titlePrefix = '') {
  const sections = [];
  const topLevelRows = [];

  Object.entries(results || {}).forEach(([key, val]) => {
    if (SKIP_KEYS.has(key)) return;
    if (key === 'warnings') return; // تُعرض في قسم مستقل بالتقرير
    if (key === 'materials') return; // تُعرض عبر قسم مواد مخصص بالتقرير
    if (val == null) return;

    if (Array.isArray(val)) {
      if (val.length === 0) return;
      if (typeof val[0] === 'object') {
        val.forEach((item, idx) => {
          const sub = flattenResultsForReport(item, depth + 1);
          sub.forEach((s) => sections.push({ ...s, title: `${labelFor(key)} #${idx + 1}${s.title ? ' — ' + s.title : ''}` }));
        });
      } else {
        topLevelRows.push({ label: labelFor(key), value: val.join(', ') });
      }
      return;
    }

    if (typeof val === 'object') {
      const sub = flattenResultsForReport(val, depth + 1);
      if (sub.length === 1 && !sub[0].title) {
        sections.push({ title: SECTION_LABELS[key] || labelFor(key), rows: sub[0].rows });
      } else if (sub.length > 0) {
        sections.push({ title: SECTION_LABELS[key] || labelFor(key), rows: [], children: sub });
      }
      return;
    }

    topLevelRows.push({ label: labelFor(key), value: formatValue(key, val) });
  });

  const result = [];
  if (topLevelRows.length) result.push({ title: depth === 0 ? 'ملخص عام' : '', rows: topLevelRows });
  result.push(...sections);
  return result;
}
