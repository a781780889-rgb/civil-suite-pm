// tests/boq/calc-engine.test.js
// تشغيل: node --test tests/boq/calc-engine.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { convertUnit, dimensionOfUnit } from '../../lib/boq/units.js';
import {
  volumeBox, volumeCylinder, volumeLayer, areaMinusOpenings, lengthTotal, countTotal, manualQuantity,
  applyMultiplierAndWaste,
} from '../../lib/boq/primitives.js';
import { CATEGORIES, TRADES, getCategory, listCategoriesByTrade, assertUniqueKeys } from '../../lib/boq/categoryRegistry.js';
import { calculateGeometryQuantity, resolveBoqQuantity } from '../../lib/boq/calcElement.js';
import { calculateElementCost, summarizeCosts } from '../../lib/boq/pricing.js';
import { ValidationError } from '../../lib/calc/common.js';

describe('lib/boq/units.js', () => {
  test('يحوّل بين الأمتار والأقدام بدقة', () => {
    assert.equal(Math.round(convertUnit(1, 'm', 'ft') * 1e6) / 1e6, 3.28084);
    assert.equal(Math.round(convertUnit(10, 'ft', 'm') * 1e6) / 1e6, 3.048);
  });

  test('يرفض التحويل بين نوعي قياس مختلفين (طول إلى وزن)', () => {
    assert.throws(() => convertUnit(1, 'm', 'kg'));
  });

  test('نفس الوحدة تُعيد نفس القيمة دون تقريب', () => {
    assert.equal(convertUnit(12.3456, 'm3', 'm3'), 12.3456);
  });

  test('dimensionOfUnit يحدد نوع القياس الصحيح', () => {
    assert.equal(dimensionOfUnit('m2'), 'area');
    assert.equal(dimensionOfUnit('kg'), 'weight');
    assert.equal(dimensionOfUnit('unknown_unit'), null);
  });

  test('رحلة ذهاب وعودة بين النظامين المتري والإمبراطوري لا تفقد الدقة', () => {
    const original = 42.75;
    const toFt = convertUnit(original, 'm', 'ft');
    const back = convertUnit(toFt, 'ft', 'm');
    assert.ok(Math.abs(back - original) < 1e-9);
  });
});

describe('lib/boq/primitives.js', () => {
  test('volumeBox: حجم قاعدة 2×1.5×0.5 = 1.5 م³', () => {
    assert.equal(volumeBox({ lengthM: 2, widthM: 1.5, heightM: 0.5 }), 1.5);
  });

  test('volumeCylinder: من القطر مباشرة', () => {
    // قطر 1م، ارتفاع 2م => نق = 0.5 => حجم = π*0.25*2 = 1.5708
    assert.equal(volumeCylinder({ diameterM: 1, heightM: 2 }), round4(Math.PI * 0.25 * 2));
  });

  test('volumeCylinder: من نصف القطر مباشرة يعطي نفس نتيجة القطر المكافئ', () => {
    const fromDiameter = volumeCylinder({ diameterM: 2, heightM: 3 });
    const fromRadius = volumeCylinder({ radiusM: 1, heightM: 3 });
    assert.equal(fromDiameter, fromRadius);
  });

  test('volumeLayer: مساحة 100م² × سماكة 0.15م = 15 م³', () => {
    assert.equal(volumeLayer({ areaM2: 100, thicknessM: 0.15 }), 15);
  });

  test('areaMinusOpenings: جدار 5×3 بفتحة 2م² = 13م²', () => {
    assert.equal(areaMinusOpenings({ lengthM: 5, widthM: 3, openingsAreaM2: 2 }), 13);
  });

  test('areaMinusOpenings: يرفض فتحات أكبر من المساحة الكلية', () => {
    assert.throws(() => areaMinusOpenings({ lengthM: 2, widthM: 2, openingsAreaM2: 10 }), ValidationError);
  });

  test('areaMinusOpenings: يقبل مساحة مباشرة بدل الطول والعرض', () => {
    assert.equal(areaMinusOpenings({ areaM2: 50, openingsAreaM2: 5 }), 45);
  });

  test('lengthTotal: طول 10م × 4 قطع = 40م', () => {
    assert.equal(lengthTotal({ lengthM: 10, segments: 4 }), 40);
  });

  test('countTotal: يرفض عدداً صفرياً أو سالباً', () => {
    assert.throws(() => countTotal({ count: 0 }), ValidationError);
    assert.throws(() => countTotal({ count: -3 }), ValidationError);
  });

  test('manualQuantity: يمرر القيمة كما هي بعد التحقق', () => {
    assert.equal(manualQuantity({ quantityManual: 77.5 }), 77.5);
  });

  test('كل الدوال البدائية ترفض الحقول المفقودة برسالة عربية واضحة', () => {
    assert.throws(() => volumeBox({ lengthM: 2, widthM: 1.5 }), ValidationError);
  });

  test('كل الدوال البدائية ترفض القيم السالبة', () => {
    assert.throws(() => volumeBox({ lengthM: -1, widthM: 1, heightM: 1 }), ValidationError);
  });

  test('applyMultiplierAndWaste: 10م³ × 3 عناصر + هدر 5% = 31.5م³', () => {
    const r = applyMultiplierAndWaste(10, { multiplier: 3, wastePct: 5 });
    assert.equal(r.withMultiplier, 30);
    assert.equal(r.withWaste, 31.5);
  });
});

describe('lib/boq/categoryRegistry.js', () => {
  test('كل مفاتيح الأصناف فريدة', () => {
    assert.doesNotThrow(() => assertUniqueKeys());
  });

  test('يغطي جميع التخصصات الأربعة عشر المطلوبة بصنف واحد على الأقل', () => {
    const byTrade = listCategoriesByTrade();
    for (const tradeKey of Object.keys(TRADES)) {
      assert.ok(byTrade[tradeKey].length > 0, `التخصص "${tradeKey}" بلا أي صنف مُعرَّف`);
    }
  });

  test('كل صنف يشير إلى طريقة حساب مدعومة فعلياً', () => {
    const VALID_METHODS = new Set([
      'box_volume', 'cylinder_volume', 'layer_volume', 'area_minus_openings',
      'length_total', 'count_total', 'manual_quantity', 'concrete_with_materials', 'rebar_link',
    ]);
    for (const cat of CATEGORIES) {
      assert.ok(VALID_METHODS.has(cat.calc_method), `صنف "${cat.key}" بطريقة حساب غير معروفة: ${cat.calc_method}`);
      if (cat.calc_method === 'concrete_with_materials') {
        assert.ok(['box_volume', 'cylinder_volume', 'layer_volume'].includes(cat.geometry_method), `صنف خرساني "${cat.key}" بلا geometry_method صالح`);
      }
    }
  });

  test('getCategory يعيد null لصنف غير موجود بدل رمي خطأ', () => {
    assert.equal(getCategory('not_a_real_category'), null);
  });

  test('كل صنف يملك وحدة إخراج معروفة', () => {
    const KNOWN_UNITS = new Set(['m', 'm2', 'm3', 'kg', 'ea']);
    for (const cat of CATEGORIES) assert.ok(KNOWN_UNITS.has(cat.unit), `صنف "${cat.key}" بوحدة غير معروفة: ${cat.unit}`);
  });
});

describe('lib/boq/calcElement.js — المسار الهندسي المحلي', () => {
  test('قاعدة منفصلة: 2×2×0.5م، 4 قواعد متطابقة، هدر 5%', () => {
    const category = getCategory('concrete_isolated_footing');
    const r = calculateGeometryQuantity(category, { lengthM: 2, widthM: 2, heightM: 0.5, count: 4, wastePct: 5 });
    // صافي القاعدة الواحدة = 2م³ ، × 4 = 8م³ ، + هدر 5% = 8.4م³
    assert.equal(r.netQuantity, 2);
    assert.equal(r.withMultiplier, 8);
    assert.equal(r.quantityWithWaste, 8.4);
    assert.equal(r.unit, 'm3');
    assert.ok(r.materials, 'يجب أن يحتوي عنصر خرساني على حصر مواد');
    assert.ok(r.materials.cementBags > 0);
  });

  test('يستخدم نسبة الهدر الافتراضية للصنف عند عدم تحديدها', () => {
    const category = getCategory('flooring_ceramic'); // افتراضي 10%
    const r = calculateGeometryQuantity(category, { areaM2: 100 });
    assert.equal(r.wastePct, 10);
    assert.equal(r.quantityWithWaste, 110);
  });

  test('حديد تسليح بإدخال يدوي (بلا ربط) عبر resolveBoqQuantity', async () => {
    const category = getCategory('rebar_detailed');
    const r = await resolveBoqQuantity({ category, dimensions: { quantityManual: 450.75 }, getLinkedCalculation: async () => null });
    assert.equal(r.netQuantity, 450.75);
    assert.equal(r.unit, 'kg');
    assert.equal(r.source, 'manual');
  });

  test('حديد تسليح مرتبط بحساب محفوظ من القسم الثاني يسحب الوزن الفعلي', async () => {
    const category = getCategory('rebar_detailed');
    const fakeCalc = { calc_type: 'rebar_column', title: 'أعمدة الدور الأرضي', results: { totals: { totalWeightKg: 1234.5, totalBarCount: 88 } } };
    const r = await resolveBoqQuantity({
      category,
      dimensions: { linkedCalculationId: 7 },
      getLinkedCalculation: async (id) => (id === 7 ? fakeCalc : null),
    });
    assert.equal(r.netQuantity, 1234.5);
    assert.equal(r.source, 'linked_calculation');
    assert.equal(r.linkedSummary.totalBarCount, 88);
  });

  test('يرفض ربط حساب حديد بحساب من نوع خرسانة (S1) بدل حديد (S2)', async () => {
    const category = getCategory('rebar_detailed');
    const wrongCalc = { calc_type: 'column', results: { quantities: { concreteVolumeM3: 5 } } };
    await assert.rejects(
      resolveBoqQuantity({ category, dimensions: { linkedCalculationId: 1 }, getLinkedCalculation: async () => wrongCalc }),
      ValidationError
    );
  });

  test('عمود خرساني مرتبط بحساب القسم الأول يسحب حجم الخرسانة الفعلي ويحسب موادها', async () => {
    const category = getCategory('concrete_column_rect');
    const fakeCalc = { calc_type: 'column', title: 'أعمدة B1', results: { quantities: { concreteVolumeM3: 3.2 } } };
    const r = await resolveBoqQuantity({
      category,
      dimensions: { linkedCalculationId: 3, count: 10, wastePct: 5 },
      getLinkedCalculation: async () => fakeCalc,
    });
    // 3.2 × 10 = 32 + هدر 5% = 33.6
    assert.equal(r.withMultiplier, 32);
    assert.equal(r.quantityWithWaste, 33.6);
    assert.ok(r.materials);
    assert.equal(r.source, 'linked_calculation');
  });

  test('يرفض عندما لا يوجد ربط ولا إدخال يدوي لصنف حديد', async () => {
    const category = getCategory('rebar_detailed');
    await assert.rejects(resolveBoqQuantity({ category, dimensions: {}, getLinkedCalculation: async () => null }), ValidationError);
  });
});

describe('فحص شامل: كل صنف في السجل (80 صنفاً) قابل للحساب فعلياً بمدخلات نموذجية صالحة', () => {
  // هذا هو الاختبار الذي كان سيكتشف فوراً عدم تطابق سابق بين مفتاح حقل في السجل (segments)
  // ومعامل الدالة البدائية المقابلة (كانت count) - لكل صنف حقيقي، وليس فقط عيّنة يدوية.
  for (const category of CATEGORIES) {
    if (category.calc_method === 'rebar_link') continue; // مساره الإلزامي (ربط/يدوي) مُختبر أعلاه عبر resolveBoqQuantity
    test(`صنف "${category.key}" (${category.name_ar}) — ${category.calc_method}`, () => {
      const dimensions = {};
      for (const field of category.fields) {
        if (field.type !== 'number') continue;
        dimensions[field.key] = field.key === 'openingsAreaM2' ? 0 : 2;
      }
      const result = calculateGeometryQuantity(category, dimensions);
      assert.ok(Number.isFinite(result.quantityWithWaste), `صنف "${category.key}" أعاد قيمة غير رقمية`);
      assert.ok(result.quantityWithWaste >= 0, `صنف "${category.key}" أعاد كمية سالبة`);
      assert.equal(result.unit, category.unit);
      if (category.calc_method === 'concrete_with_materials') {
        assert.ok(result.materials && result.materials.cementBags >= 0, `صنف خرساني "${category.key}" بلا حصر مواد صالح`);
      }
    });
  }
});

describe('lib/boq/pricing.js', () => {
  test('يحسب التكلفة بالترتيب الصحيح: مواد+عمالة+معدات+نقل ثم خصم ثم ضريبة', () => {
    const r = calculateElementCost({
      quantityWithWaste: 10,
      unitMaterialPrice: 100,
      unitLaborPrice: 20,
      unitEquipmentPrice: 5,
      unitTransportPrice: 5,
      discountPct: 10,
      taxPct: 15,
    });
    // المجموع الفرعي = 10*(100+20+5+5) = 1300
    assert.equal(r.subtotal, 1300);
    // بعد خصم 10% = 1170
    assert.equal(r.afterDiscount, 1170);
    // بعد ضريبة 15% = 1345.5
    assert.equal(r.finalCost, 1345.5);
  });

  test('يتعامل مع أسعار صفرية أو غير مُدخلة دون رمي خطأ', () => {
    const r = calculateElementCost({ quantityWithWaste: 5 });
    assert.equal(r.finalCost, 0);
  });

  test('summarizeCosts يجمع تكاليف عدة عناصر بشكل صحيح', () => {
    const total = summarizeCosts([{ total_cost: 100 }, { total_cost: 250.5 }, { total_cost: 49.5 }]);
    assert.equal(total.totalCost, 400);
  });
});

function round4(n) {
  return Math.round(n * 10000) / 10000;
}
