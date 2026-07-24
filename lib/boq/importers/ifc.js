// lib/boq/importers/ifc.js
// =============================================================================
// استيراد من ملفات IFC (BIM) - النطاق الحقيقي المُطبَّق هنا وحدوده بوضوح:
//
//   يقرأ هذا المحلّل ملف IFC كنص SPF/STEP (ISO-10303-21) القياسي - وهو تنسيق نصي وليس
//   ثنائياً، لذا لا حاجة لمحرك BIM خارجي لقراءته. يستخرج:
//     1) الكيانات الإنشائية/المعمارية المُسمّاة (IFCWALL, IFCSLAB, IFCCOLUMN, IFCBEAM,
//        IFCFOOTING, IFCPILE, IFCROOF, IFCSTAIR, IFCDOOR, IFCWINDOW, IFCCOVERING...).
//     2) "مجموعات الكميات" (IfcElementQuantity) المرتبطة بكل عنصر عبر علاقة
//        IfcRelDefinesByProperties - وهي الكميات (طول/مساحة/حجم/وزن/عدد) التي يُصدّرها
//        برنامج BIM المُصدِّر فعلياً (Revit/ArchiCAD وغيرهما) عند تفعيل Quantity Takeoff،
//        وهذا هو المسار الذي تعتمده برامج حصر الكميات الاحترافية فعلياً في الغالب - قراءة
//        الكميات المُصرَّح بها في الملف لا إعادة اشتقاقها هندسياً من جديد.
//
//   خارج النطاق (صراحة، بلا أي ادّعاء عكس ذلك): لا يوجد هنا محرك تمثيل هندسي ثلاثي الأبعاد
//   (B-rep/Geometry Kernel) لإعادة بناء الأحجام من الهندسة الخام إن لم يُصدّرها البرنامج
//   كمجموعة كميات جاهزة. إن لم يحتوِ الملف IfcElementQuantity لعنصر ما، تُعاد الكمية "null"
//   صراحة ويُطلب من المستخدم إدخالها يدوياً - تحديداً حتى لا يُعرض رقم مُخترَع (يمنعه صراحة
//   بند "عدم استخدام بيانات وهمية أو نتائج تقديرية عند توفر البيانات الفعلية").
// =============================================================================

const ELEMENT_TYPE_TO_CATEGORY_HINT = {
  IFCWALL: 'concrete_wall', IFCWALLSTANDARDCASE: 'concrete_wall',
  IFCSLAB: 'concrete_slab', IFCCOLUMN: 'concrete_column_rect', IFCBEAM: 'concrete_beam',
  IFCFOOTING: 'concrete_isolated_footing', IFCPILE: 'concrete_pile', IFCROOF: 'concrete_roof_slab',
  IFCSTAIR: 'concrete_stairs', IFCSTAIRFLIGHT: 'concrete_stairs', IFCRAILING: null,
  IFCPLATE: null, IFCMEMBER: null, IFCBUILDINGELEMENTPROXY: null,
  IFCDOOR: 'carpentry_doors', IFCWINDOW: 'alumglass_windows', IFCCOVERING: 'ceiling_suspended',
};

const QUANTITY_TYPE_KIND = {
  IFCQUANTITYLENGTH: 'length', IFCQUANTITYAREA: 'area', IFCQUANTITYVOLUME: 'volume',
  IFCQUANTITYWEIGHT: 'weight', IFCQUANTITYCOUNT: 'count',
};

/** يفكّك محتوى DATA إلى كائنات {id, type, argsText} مع احترام الأقواس المتداخلة والنصوص المقتبَسة فعلياً */
function splitStepInstances(dataText) {
  const instances = [];
  const n = dataText.length;
  let i = 0;
  while (i < n) {
    while (i < n && dataText[i] !== '#') i += 1;
    if (i >= n) break;
    let j = i + 1;
    while (j < n && dataText[j] >= '0' && dataText[j] <= '9') j += 1;
    const id = dataText.slice(i, j);
    let k = j;
    while (k < n && /\s/.test(dataText[k])) k += 1;
    if (dataText[k] !== '=') { i = j; continue; }
    k += 1;
    while (k < n && /\s/.test(dataText[k])) k += 1;
    const typeStart = k;
    while (k < n && /[A-Za-z0-9_]/.test(dataText[k])) k += 1;
    const type = dataText.slice(typeStart, k).toUpperCase();
    while (k < n && dataText[k] !== '(' && dataText[k] !== ';') k += 1;
    if (dataText[k] !== '(') { i = k + 1; continue; }
    const contentStart = k;
    let depth = 0;
    let inString = false;
    let end = k;
    for (; end < n; end += 1) {
      const ch = dataText[end];
      if (inString) {
        if (ch === "'") {
          if (dataText[end + 1] === "'") { end += 1; continue; }
          inString = false;
        }
        continue;
      }
      if (ch === "'") { inString = true; continue; }
      if (ch === '(') depth += 1;
      else if (ch === ')') { depth -= 1; if (depth === 0) { end += 1; break; } }
    }
    const argsText = dataText.slice(contentStart, end);
    while (end < n && dataText[end] !== ';') end += 1;
    instances.push({ id, type, argsText });
    i = end + 1;
  }
  return instances;
}

/** يفكّك قائمة معاملات على المستوى الأعلى فقط (بلا الدخول داخل الأقواس المتداخلة أو النصوص) */
function splitTopLevelArgs(argsText) {
  const inner = argsText.slice(1, -1);
  const args = [];
  let depth = 0;
  let inString = false;
  let current = '';
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i];
    if (inString) {
      current += ch;
      if (ch === "'") {
        if (inner[i + 1] === "'") { current += inner[i + 1]; i += 1; continue; }
        inString = false;
      }
      continue;
    }
    if (ch === "'") { inString = true; current += ch; continue; }
    if (ch === '(') { depth += 1; current += ch; continue; }
    if (ch === ')') { depth -= 1; current += ch; continue; }
    if (ch === ',' && depth === 0) { args.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  if (current.trim() !== '') args.push(current.trim());
  return args;
}

function parseArgToken(tok) {
  if (tok === undefined) return null;
  if (tok === '$' || tok === '') return null;
  if (tok === '*') return undefined;
  if (tok.startsWith("'") && tok.endsWith("'")) return tok.slice(1, -1).replace(/''/g, "'");
  if (tok.startsWith('#')) return tok;
  if (tok.startsWith('(') && tok.endsWith(')')) return splitTopLevelArgs(tok).map(parseArgToken);
  if (tok.startsWith('.') && tok.endsWith('.')) return tok.slice(1, -1);
  const n = Number(tok);
  return Number.isNaN(n) ? tok : n;
}

export function parseIfcFile(ifcText) {
  const match = ifcText.match(/DATA;([\s\S]*)ENDSEC;\s*END-ISO-10303-21/i) || ifcText.match(/DATA;([\s\S]*)/i);
  if (!match) {
    throw new Error('لم يُعثر على قسم DATA في الملف - تأكد أنه ملف IFC نصي بصيغة STEP (امتداد .ifc) وليس IFCZIP أو IfcXML.');
  }
  const instances = splitStepInstances(match[1]);
  if (!instances.length) throw new Error('لم يُعثر على أي كيانات داخل قسم DATA.');
  return instances;
}

/** يستخرج العناصر الإنشائية المعروفة مع أي مجموعات كميات مرتبطة بها فعلياً في الملف */
export function extractIfcElements(instances) {
  const quantityById = new Map();
  for (const inst of instances) {
    const kind = QUANTITY_TYPE_KIND[inst.type];
    if (!kind) continue;
    const args = splitTopLevelArgs(inst.argsText).map(parseArgToken);
    quantityById.set(inst.id, { name: args[0], kind, value: typeof args[3] === 'number' ? args[3] : null });
  }

  const quantitiesByQSetId = new Map();
  for (const inst of instances) {
    if (inst.type !== 'IFCELEMENTQUANTITY') continue;
    const args = splitTopLevelArgs(inst.argsText).map(parseArgToken);
    const list = Array.isArray(args[5]) ? args[5] : [];
    quantitiesByQSetId.set(inst.id, list.map((ref) => quantityById.get(ref)).filter(Boolean));
  }

  const quantitiesByElementId = new Map();
  for (const inst of instances) {
    if (inst.type !== 'IFCRELDEFINESBYPROPERTIES') continue;
    const args = splitTopLevelArgs(inst.argsText).map(parseArgToken);
    const relatedObjects = Array.isArray(args[4]) ? args[4] : [];
    const propDef = args[5];
    const quantities = quantitiesByQSetId.get(propDef);
    if (!quantities || !quantities.length) continue;
    for (const elId of relatedObjects) {
      quantitiesByElementId.set(elId, (quantitiesByElementId.get(elId) || []).concat(quantities));
    }
  }

  const elements = [];
  for (const inst of instances) {
    if (!(inst.type in ELEMENT_TYPE_TO_CATEGORY_HINT)) continue;
    const args = splitTopLevelArgs(inst.argsText).map(parseArgToken);
    const name = typeof args[2] === 'string' && args[2] ? args[2] : null;
    elements.push({
      ifcId: inst.id,
      ifcType: inst.type,
      name: name || `${inst.type} #${inst.id}`,
      description: typeof args[3] === 'string' ? args[3] : null,
      suggestedCategoryKey: ELEMENT_TYPE_TO_CATEGORY_HINT[inst.type] || null,
      quantities: quantitiesByElementId.get(inst.id) || [],
    });
  }
  return elements;
}

/** ملخّص حسب نوع الكيان (لواجهة استعراض/تعيين قبل الاستيراد الفعلي) */
export function summarizeIfcElements(elements) {
  const byType = new Map();
  for (const el of elements) {
    if (!byType.has(el.ifcType)) {
      byType.set(el.ifcType, { ifcType: el.ifcType, count: 0, withQuantities: 0, suggestedCategoryKey: el.suggestedCategoryKey, sampleNames: [] });
    }
    const bucket = byType.get(el.ifcType);
    bucket.count += 1;
    if (el.quantities.length) bucket.withQuantities += 1;
    if (bucket.sampleNames.length < 3) bucket.sampleNames.push(el.name);
  }
  return Array.from(byType.values()).sort((a, b) => b.count - a.count);
}

const UNIT_FOR_KIND = { length: 'm', area: 'm2', volume: 'm3', weight: 'kg', count: 'ea' };

/** يبحث عن كمية بالوحدة المناسبة لصنف BOQ مُختار ضمن كميات عنصر IFC (أو null إن لم توجد) */
export function findIfcQuantityForCategory(element, category) {
  const neededKind = Object.keys(UNIT_FOR_KIND).find((k) => UNIT_FOR_KIND[k] === category.unit);
  const found = element.quantities.find((q) => q.kind === neededKind && typeof q.value === 'number' && q.value > 0);
  return found ? { value: found.value, quantityName: found.name } : null;
}
