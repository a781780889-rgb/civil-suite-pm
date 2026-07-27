// tests/business/calc.test.js — نفس نمط tests/pm/*.test.js (node --test + assert/strict)
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeQuoteItemTotal, computeQuoteTotals, computeContractCurrentValue,
  computeProgressPaymentNetDue, computePartnerOverallRating, computeWeightedPipelineValue,
} from '../../lib/business/calc.js';

describe('حسابات عروض الأسعار', () => {
  test('بند بسيط بلا خصم ولا ضريبة', () => {
    assert.equal(computeQuoteItemTotal({ quantity: 10, unit_price: 100 }), 1000);
  });

  test('بند مع خصم 10% وضريبة 15%', () => {
    // 10*100=1000 → بعد خصم 10%=900 → بعد ضريبة 15%=1035
    assert.equal(computeQuoteItemTotal({ quantity: 10, unit_price: 100, discount_pct: 10, tax_pct: 15 }), 1035);
  });

  test('إجماليات عرض سعر متعدد البنود مع خصم وضريبة على مستوى العرض', () => {
    const items = [{ quantity: 1, unit_price: 1000 }, { quantity: 2, unit_price: 500 }];
    const totals = computeQuoteTotals(items, { discount_pct: 10, tax_pct: 15, other_costs: 50 });
    assert.equal(totals.subtotal, 2000);
    assert.equal(totals.discount_value, 200);
    // (2000-200)=1800 * 1.15 = 2070 + 50 = 2120
    assert.equal(totals.total, 2120);
  });
});

describe('قيمة العقد الحالية (أوامر التغيير)', () => {
  test('لا تتأثر بأوامر التغيير غير المعتمدة - المتصل يمرر فقط المعتمدة', () => {
    assert.equal(computeContractCurrentValue(100000, []), 100000);
  });

  test('تجمع فرق القيمة لكل أوامر التغيير المُمرَّرة إليها فقط', () => {
    assert.equal(computeContractCurrentValue(100000, [{ delta_value: 5000 }, { delta_value: -1000 }]), 104000);
  });
});

describe('صافي مستحق المستخلص', () => {
  test('يحسب أعمال الفترة الحالية ثم يخصم الضمان والاستقطاعات والدفعات السابقة', () => {
    const result = computeProgressPaymentNetDue({
      work_value_to_date: 500000, previous_work_value: 300000, retention_pct: 10, other_deductions: 2000, previous_payments_total: 150000,
    });
    // الفترة الحالية = 200000، ضمان 10% = 20000، صافي = 200000-20000-2000-150000 = 28000
    assert.equal(result.currentPeriodValue, 200000);
    assert.equal(result.retentionAmount, 20000);
    assert.equal(result.netDue, 28000);
  });
});

describe('متوسط تقييم الشريك', () => {
  test('يعيد null بلا تقييمات', () => {
    assert.equal(computePartnerOverallRating([]), null);
  });
  test('يحسب متوسط الأبعاد الأربعة والعام', () => {
    const avg = computePartnerOverallRating([
      { quality: 4, schedule_adherence: 4, cost: 4, safety: 4 },
      { quality: 2, schedule_adherence: 2, cost: 2, safety: 2 },
    ]);
    assert.equal(avg.quality, 3);
    assert.equal(avg.overall, 3);
  });
});

describe('القيمة المرجّحة لخط أنابيب الفرص', () => {
  test('تستبعد الفرص المُغلقة (فوز/خسارة) وتُرجّح المفتوحة باحتمالية الفوز', () => {
    const value = computeWeightedPipelineValue([
      { expected_value: 100000, win_probability: 50, stage: 'negotiation' },
      { expected_value: 200000, win_probability: 100, stage: 'won' }, // مستبعدة
      { expected_value: 50000, win_probability: 20, stage: 'new' },
    ]);
    assert.equal(value, 60000); // 50000 + 10000
  });
});
