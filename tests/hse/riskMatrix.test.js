// tests/hse/riskMatrix.test.js
// اختبار مصفوفة تقييم المخاطر (بلا قاعدة بيانات) - البند 4.
// تشغيل: node --test tests/hse/riskMatrix.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeRiskLevel, buildRiskMatrixGrid, compareRiskAssessments, riskLevelLabel, RISK_LEVEL_BANDS,
} from '../../lib/hse/riskMatrix.js';

describe('حساب مستوى الخطورة (Likelihood × Severity)', () => {
  test('1×1 يقع في النطاق المنخفض', () => {
    const r = computeRiskLevel(1, 1);
    assert.equal(r.score, 1);
    assert.equal(r.level, 'low');
  });

  test('5×5 (الأسوأ الممكن) يقع في النطاق الحرج', () => {
    const r = computeRiskLevel(5, 5);
    assert.equal(r.score, 25);
    assert.equal(r.level, 'critical');
  });

  test('3×3=9 يقع عند الحد الأعلى لنطاق متوسط (وليس مرتفع)', () => {
    assert.equal(computeRiskLevel(3, 3).level, 'medium');
  });

  test('2×5=10 يقع عند الحد الأدنى لنطاق مرتفع', () => {
    assert.equal(computeRiskLevel(2, 5).level, 'high');
  });

  test('يرفض قيماً خارج المدى 1-5', () => {
    assert.throws(() => computeRiskLevel(0, 3), /الاحتمالية/);
    assert.throws(() => computeRiskLevel(3, 6), /شدة التأثير/);
  });

  test('يرفض قيماً عشرية أو غير رقمية', () => {
    assert.throws(() => computeRiskLevel(2.5, 3));
    assert.throws(() => computeRiskLevel('عالي', 3));
  });

  test('النطاقات الأربعة تغطي 1-25 بلا فجوة أو تداخل', () => {
    for (let score = 1; score <= 25; score += 1) {
      const matches = RISK_LEVEL_BANDS.filter((b) => score >= b.min && score <= b.max);
      assert.equal(matches.length, 1, `الدرجة ${score} يجب أن تقع في نطاق واحد بالضبط`);
    }
  });
});

describe('شبكة المصفوفة 5×5', () => {
  test('تحتوي على 5 صفوف × 5 أعمدة = 25 خلية بالضبط', () => {
    const grid = buildRiskMatrixGrid();
    assert.equal(grid.length, 5);
    for (const row of grid) assert.equal(row.length, 5);
  });
});

describe('مقارنة إعادة التقييم', () => {
  test('يكتشف تحسّناً بعد تطبيق إجراءات التحكم', () => {
    const cmp = compareRiskAssessments({ likelihood: 4, severity: 4 }, { likelihood: 2, severity: 2 });
    assert.equal(cmp.direction, 'improved');
    assert.equal(cmp.before.score, 16);
    assert.equal(cmp.after.score, 4);
  });

  test('يكتشف عدم تغيّر', () => {
    const cmp = compareRiskAssessments({ likelihood: 3, severity: 3 }, { likelihood: 3, severity: 3 });
    assert.equal(cmp.direction, 'unchanged');
  });
});

describe('تسميات المستويات بالعربية', () => {
  test('كل مستوى له تسمية عربية غير فارغة', () => {
    for (const level of ['low', 'medium', 'high', 'critical']) {
      assert.ok(riskLevelLabel(level) && riskLevelLabel(level).length > 0);
    }
  });
});
