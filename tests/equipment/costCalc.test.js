// tests/equipment/costCalc.test.js
// اختبار دوال حساب التكلفة والمؤشرات النقية (بلا قاعدة بيانات).
// تشغيل: node --test tests/equipment/costCalc.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeStraightLineDepreciation, computeCostPerHour, computeMTTR, computeMTBF,
  computeUtilizationRate, computeFuelEfficiency, computeTotalCost,
} from '../../lib/equipment/costCalc.js';

describe('الإهلاك بطريقة القسط الثابت', () => {
  test('يحسب الإهلاك السنوي والمتراكم بشكل صحيح بعد سنتين كاملتين', () => {
    const d = computeStraightLineDepreciation(
      { purchase_price: 100000, salvage_value: 10000, useful_life_years: 10, purchase_date: '2024-01-01' },
      new Date('2026-01-01')
    );
    assert.equal(d.annual_depreciation, 9000);
    assert.equal(d.accumulated_depreciation, 18000);
    assert.equal(d.book_value, 82000);
  });

  test('بلا عمر افتراضي أو تاريخ شراء، يعيد صفراً بأمان بدل خطأ', () => {
    const d = computeStraightLineDepreciation({ purchase_price: 5000 });
    assert.equal(d.annual_depreciation, 0);
    assert.equal(d.book_value, 5000);
  });
});

describe('تكلفة الساعة التشغيلية', () => {
  test('تحسب التكلفة الإجمالية مقسومة على الساعات', () => {
    assert.equal(computeCostPerHour(1000, 50), 20);
  });
  test('تعيد null إن كانت الساعات صفراً (تفادي القسمة على صفر)', () => {
    assert.equal(computeCostPerHour(1000, 0), null);
  });
});

describe('MTTR وMTBF', () => {
  test('MTTR: متوسط ساعات التوقف للأعطال ذات downtime_hours موجب فقط', () => {
    const mttr = computeMTTR([{ downtime_hours: 4 }, { downtime_hours: 8 }, { downtime_hours: 0 }]);
    assert.equal(mttr, 6);
  });
  test('MTBF: إجمالي الساعات مقسوماً على عدد الأعطال', () => {
    assert.equal(computeMTBF(1000, 4), 250);
  });
  test('MTBF بلا أعطال يعيد null (لا قسمة على صفر)', () => {
    assert.equal(computeMTBF(1000, 0), null);
  });
});

describe('نسبة الاستغلال وكفاءة الوقود', () => {
  test('نسبة الاستغلال = الساعات الفعلية / الساعات المتاحة × 100', () => {
    assert.equal(computeUtilizationRate(160, 200), 80);
  });
  test('كفاءة الوقود تكتشف انحرافاً موجباً عن المعدل المرجعي', () => {
    const eff = computeFuelEfficiency(150, 100, 1); // 1.5 لتر/ساعة فعلي مقابل 1 مرجعي
    assert.equal(eff.actual_l_per_hour, 1.5);
    assert.equal(eff.deviation_pct, 50);
  });
});

describe('إجمالي التكلفة الفعلية', () => {
  test('يجمع كل بنود التكلفة الستة', () => {
    const total = computeTotalCost({ depreciation: 100, fuel: 200, maintenance: 300, spareParts: 50, rental: 400, transfer: 25 });
    assert.equal(total, 1075);
  });
  test('البنود الناقصة تُعامل كصفر دون رمي خطأ', () => {
    assert.equal(computeTotalCost({ fuel: 100 }), 100);
  });
});
