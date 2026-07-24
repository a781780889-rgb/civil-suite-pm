// lib/boq/calcElement.js
// =============================================================================
// نقطة الحساب المركزية لعنصر حصر كميات واحد. مقسّمة عمداً إلى دالتين:
//
// 1) calculateGeometryQuantity  - نقية 100% (بلا أي اتصال بقاعدة بيانات) تحسب الكمية من
//    الأبعاد المُدخلة مباشرة عبر lib/boq/primitives.js. قابلة للاختبار بمعزل تام.
//
// 2) resolveBoqQuantity - طبقة رقيقة فوقها تضيف مسار "الربط" الخاص بصنفَي الخرسانة وحديد
//    التسليح: بدل إعادة اشتقاق حجم الخرسانة أو وزن الحديد بمعادلة مبسّطة داخل هذا القسم
//    (وهو بالضبط ما تمنعه القاعدة الثانية من "قواعد الحسابات الهندسية" - تكرار لمنطق
//    موجود ومُتحقَّق منه فعلاً)، تسحب الكمية الحقيقية مباشرة من حساب محفوظ سابقاً في حاسبة
//    القسم الأول (حجم الخرسانة) أو الثاني (وزن الحديد النهائي شامل الوصلات والخطافات).
//    الوصول لقاعدة البيانات يتم عبر معامل getLinkedCalculation المُحقَن (Dependency
//    Injection) وليس استيراداً مباشراً لـ lib/db.js، تحديداً لتبقى قابلة للاختبار بمُموّه
//    (mock) بسيط دون الحاجة لقاعدة بيانات حقيقية.
// =============================================================================

import { PRIMITIVES, applyMultiplierAndWaste } from './primitives.js';
import { calculateConcreteMaterials, defaultMaterialOptions } from '../calc/materials.js';
import { ValidationError, round } from '../calc/common.js';

const SELF_CONTAINED_METHODS = new Set(['length_total', 'count_total', 'manual_quantity']);

function resolveWastePct(dimensions, category) {
  if (dimensions.wastePct !== undefined && dimensions.wastePct !== '' && dimensions.wastePct !== null) {
    const n = Number(dimensions.wastePct);
    if (Number.isNaN(n) || n < 0) throw new ValidationError('نسبة الهدر يجب أن تكون رقماً موجباً.');
    return n;
  }
  return category.default_waste_pct ?? 0;
}

function resolveMultiplier(dimensions) {
  if (dimensions.count === undefined || dimensions.count === '' || dimensions.count === null) return 1;
  const n = Number(dimensions.count);
  if (Number.isNaN(n) || n <= 0) throw new ValidationError('عدد العناصر المتطابقة يجب أن يكون رقماً أكبر من صفر.');
  return n;
}

function materialsFor(dimensions, volumeWithWasteM3) {
  return calculateConcreteMaterials(
    volumeWithWasteM3,
    defaultMaterialOptions({
      grade: dimensions.grade || 'C25',
      wasteRatioPct: 0, // الهدر مُطبَّق مسبقاً على الحجم أعلاه؛ عدم تكراره هنا
      cementType: dimensions.cementType || 'OPC',
      unitPrices: dimensions.materialUnitPrices || {},
    })
  );
}

/** المسار الهندسي المحلي البحت - بلا قاعدة بيانات */
export function calculateGeometryQuantity(category, dimensions = {}) {
  if (!category) throw new ValidationError('صنف غير معروف.');
  const isConcrete = category.calc_method === 'concrete_with_materials';
  const method = isConcrete ? category.geometry_method : category.calc_method;
  const primitive = PRIMITIVES[method];
  if (!primitive) throw new ValidationError(`طريقة حساب غير مدعومة للصنف "${category.name_ar}".`);

  const netForOne = primitive(dimensions);
  const selfContained = SELF_CONTAINED_METHODS.has(method);
  const multiplier = selfContained ? 1 : resolveMultiplier(dimensions);
  const wastePct = resolveWastePct(dimensions, category);
  const { netQuantity, withMultiplier, withWaste } = applyMultiplierAndWaste(netForOne, { multiplier, wastePct });

  return {
    netQuantity,
    multiplier,
    withMultiplier,
    wastePct,
    quantityWithWaste: withWaste,
    unit: category.unit,
    materials: isConcrete ? materialsFor(dimensions, withWaste) : null,
    source: 'geometry',
  };
}

/**
 * لعناصر مصدرها كمية جاهزة مُستخرجة فعلياً من ملف (DXF/IFC) وليست أبعاداً خاماً يُشتق منها
 * الحجم/المساحة عبر primitive - تتخطى هذه الدالة محرك الحساب الهندسي عمداً لأن الكمية
 * موجودة بالفعل ومُستخرَجة من هندسة/بيانات حقيقية في الملف المستورد، لكنها تُطبّق بالضبط
 * نفس منطق المضاعِف ونسبة الهدر وحصر مواد الخرسانة الذي يطبّقه المسار اليدوي، حتى لا
 * تخضع كميات الاستيراد لقواعد مختلفة عن الكميات المُدخلة يدوياً.
 */
export function calculateFromPrecomputedQuantity(category, { netQuantity, multiplier = 1, wastePct, grade, cementType } = {}) {
  if (!(Number(netQuantity) > 0)) throw new ValidationError('الكمية المُستخرجة من الملف يجب أن تكون أكبر من صفر.');
  const finalWastePct = wastePct !== undefined && wastePct !== null && wastePct !== '' ? Number(wastePct) : (category.default_waste_pct ?? 0);
  const { netQuantity: net, withMultiplier, withWaste } = applyMultiplierAndWaste(Number(netQuantity), { multiplier, wastePct: finalWastePct });
  const isConcrete = category.calc_method === 'concrete_with_materials';
  return {
    netQuantity: net,
    multiplier,
    withMultiplier,
    wastePct: finalWastePct,
    quantityWithWaste: withWaste,
    unit: category.unit,
    materials: isConcrete ? materialsFor({ grade, cementType }, withWaste) : null,
    source: 'imported_geometry',
  };
}

/**
 * المسار الكامل شامل الربط. getLinkedCalculation(id) دالة async تُعيد صف calculations
 * بنفس شكل lib/db.js::getCalculation(id) (أي { calc_type, title, results: {...} }) أو null.
 */
export async function resolveBoqQuantity({ category, dimensions = {}, getLinkedCalculation }) {
  if (!category) throw new ValidationError('صنف غير معروف.');
  const linkedId = dimensions.linkedCalculationId || null;

  if (category.calc_method === 'rebar_link') {
    if (linkedId) {
      if (!getLinkedCalculation) throw new ValidationError('تعذّر الوصول لقاعدة بيانات الحسابات المحفوظة.');
      const calc = await getLinkedCalculation(linkedId);
      if (!calc) throw new ValidationError('حساب حديد التسليح المرتبط غير موجود أو تم حذفه.');
      if (!String(calc.calc_type || '').startsWith('rebar_')) {
        throw new ValidationError('الحساب المرتبط ليس أحد حاسبات حديد التسليح (القسم الثاني).');
      }
      const weightKg = calc.results?.totals?.totalWeightKg;
      if (!(weightKg > 0)) throw new ValidationError('الحساب المرتبط لا يحتوي على وزن حديد صالح.');
      const q = round(weightKg, 2);
      return {
        netQuantity: q, multiplier: 1, withMultiplier: q, wastePct: 0, quantityWithWaste: q,
        unit: 'kg', materials: null, source: 'linked_calculation', linkedCalculationId: linkedId,
        linkedSummary: {
          calc_type: calc.calc_type, title: calc.title || null,
          totalBarCount: calc.results?.totals?.totalBarCount ?? null,
        },
      };
    }
    const manual = dimensions.quantityManual;
    if (manual === undefined || manual === '' || manual === null) {
      throw new ValidationError('يلزم إما ربط حساب حديد محفوظ من القسم الثاني، أو إدخال الوزن يدوياً.');
    }
    const q = round(Number(manual), 2);
    if (!(q > 0)) throw new ValidationError('الوزن اليدوي المُدخل يجب أن يكون أكبر من صفر.');
    return { netQuantity: q, multiplier: 1, withMultiplier: q, wastePct: 0, quantityWithWaste: q, unit: 'kg', materials: null, source: 'manual', linkedCalculationId: null };
  }

  if (category.calc_method === 'concrete_with_materials' && linkedId) {
    if (!getLinkedCalculation) throw new ValidationError('تعذّر الوصول لقاعدة بيانات الحسابات المحفوظة.');
    const calc = await getLinkedCalculation(linkedId);
    if (!calc) throw new ValidationError('الحساب الإنشائي المرتبط غير موجود أو تم حذفه.');
    if (String(calc.calc_type || '').startsWith('rebar_')) {
      throw new ValidationError('الحساب المرتبط أحد حاسبات الحديد، والمطلوب هنا حاسبة خرسانة من القسم الأول.');
    }
    const volM3 = calc.results?.quantities?.concreteVolumeM3;
    if (!(volM3 > 0)) throw new ValidationError('الحساب المرتبط لا يحتوي على حجم خرسانة صالح.');
    const multiplier = resolveMultiplier(dimensions);
    const wastePct = resolveWastePct(dimensions, category);
    const { netQuantity, withMultiplier, withWaste } = applyMultiplierAndWaste(volM3, { multiplier, wastePct });
    return {
      netQuantity, multiplier, withMultiplier, wastePct, quantityWithWaste: withWaste, unit: 'm3',
      materials: materialsFor(dimensions, withWaste), source: 'linked_calculation', linkedCalculationId: linkedId,
      linkedSummary: { calc_type: calc.calc_type, title: calc.title || null },
    };
  }

  return calculateGeometryQuantity(category, dimensions);
}
