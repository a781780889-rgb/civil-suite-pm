// lib/boq/importers/dxf.js
// =============================================================================
// استيراد من ملفات DXF (تبادل CAD ثنائي الأبعاد - النسخة النصية المفتوحة من DWG؛ AutoCAD
// يُصدّر DXF من أي ملف DWG عبر "Save As"). النطاق الحقيقي المُطبَّق هنا:
//   - قراءة الكيانات الفعلية (LINE, LWPOLYLINE, POLYLINE, CIRCLE) بإحداثياتها الحقيقية.
//   - تجميعها حسب "الطبقة" (Layer) - وهي تسمية قياسية يستخدمها كل مهندس فعلياً في مخططاته
//     (مثال: WALLS، COLUMNS، GRID...)، وليست تخميناً من هذا الكود.
//   - حساب الطول الفعلي (مجموع أطوال الأضلاع) والمساحة الفعلية (صيغة Shoelace للمضلعات
//     المغلقة) بالإحداثيات الحقيقية - بلا أي تقريب.
// خارج النطاق (صراحة، بلا ادّعاء): لا يوجد هنا محرك تصنيف تلقائي يُخمّن أن طبقة اسمها
// "WALLS" تعني بالضرورة صنف "جدران خرسانية" في حصر الكميات - يختار المستخدم هذا الربط
// يدوياً لكل طبقة في واجهة الاستيراد (BoqImportWizard)، وهذا هو المسار الصحيح مهندسياً
// لأن اسم الطبقة وحده لا يكفي لتحديد سماكة الجدار أو نوعه الإنشائي.
// كذلك لا يوجد هنا أي قراءة لهندسة ثلاثية الأبعاد (Solids/Meshes) - فقط الكيانات
// ثنائية الأبعاد المذكورة أعلاه.
// =============================================================================

import DxfParser from 'dxf-parser';

// $INSUNITS (كود رأس DXF قياسي) - القيم الأكثر شيوعاً في مخططات الإنشاءات
const INSUNITS_TO_METERS = { 1: 0.0254, 2: 0.3048, 4: 0.001, 5: 0.01, 6: 1 };
const INSUNITS_LABEL = { 1: 'بوصة', 2: 'قدم', 4: 'مليمتر', 5: 'سنتيمتر', 6: 'متر' };

function distance(a, b) {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

function polylineLength(vertices, closed) {
  let len = 0;
  for (let i = 0; i < vertices.length - 1; i += 1) len += distance(vertices[i], vertices[i + 1]);
  if (closed && vertices.length > 2) len += distance(vertices[vertices.length - 1], vertices[0]);
  return len;
}

/** صيغة الحذاء المرصوص (Shoelace) - مساحة مضلع مغلق فعلية من إحداثيات رؤوسه */
function shoelaceArea(vertices) {
  let sum = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export function parseDxfFile(dxfText) {
  const parser = new DxfParser();
  try {
    return parser.parseSync(dxfText);
  } catch (err) {
    throw new Error(`تعذّر تحليل ملف DXF: ${err.message}`);
  }
}

/**
 * يجمع كيانات DXF حسب الطبقة ويحسب الطول/المساحة الفعليين بعد تحويل وحدات الرسم إلى أمتار.
 * unitScale: عامل تحويل من وحدة الرسم إلى المتر (افتراضياً 0.001 = الرسم بالمليمتر، الأشيع
 * هندسياً)؛ إن وُجد رأس $INSUNITS في الملف يُستخدم كقيمة مقترحة (insUnitsHint) تعرضها الواجهة
 * للمستخدم ليؤكدها أو يغيّرها - لا نفترض الوحدة الصحيحة صمتاً لأن ملفات DXF تختلف كثيراً.
 */
export function summarizeDxfLayers(dxf, { unitScale = 0.001 } = {}) {
  const layers = {};
  let unmapped = 0;

  const touch = (layerName) => {
    if (!layers[layerName]) {
      layers[layerName] = { layer: layerName, entityCount: 0, lengthM: 0, areaM2: 0, closedCount: 0, openCount: 0, circleCount: 0, lineCount: 0 };
    }
    return layers[layerName];
  };

  for (const entity of dxf.entities || []) {
    const layerName = entity.layer || '0';
    const bucket = touch(layerName);
    bucket.entityCount += 1;

    if (entity.type === 'LINE' && entity.vertices?.length === 2) {
      const [a, b] = entity.vertices;
      bucket.lengthM += distance(a, b) * unitScale;
      bucket.lineCount += 1;
    } else if ((entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') && entity.vertices?.length >= 2) {
      const closed = !!entity.shape;
      bucket.lengthM += polylineLength(entity.vertices, closed) * unitScale;
      if (closed && entity.vertices.length >= 3) {
        bucket.areaM2 += shoelaceArea(entity.vertices) * unitScale ** 2;
        bucket.closedCount += 1;
      } else {
        bucket.openCount += 1;
      }
    } else if (entity.type === 'CIRCLE' && entity.radius) {
      const rM = entity.radius * unitScale;
      bucket.areaM2 += Math.PI * rM ** 2;
      bucket.lengthM += 2 * Math.PI * rM;
      bucket.circleCount += 1;
    } else {
      unmapped += 1;
    }
  }

  const insUnitsCode = dxf.header?.$INSUNITS;
  const insUnitsHint = insUnitsCode != null && INSUNITS_TO_METERS[insUnitsCode]
    ? { code: insUnitsCode, label: INSUNITS_LABEL[insUnitsCode], suggestedScale: INSUNITS_TO_METERS[insUnitsCode] }
    : null;

  return {
    layers: Object.values(layers)
      .map((l) => ({ ...l, lengthM: round3(l.lengthM), areaM2: round3(l.areaM2) }))
      .sort((a, b) => b.entityCount - a.entityCount),
    unmappedEntityCount: unmapped,
    totalEntities: (dxf.entities || []).length,
    insUnitsHint,
  };
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}
