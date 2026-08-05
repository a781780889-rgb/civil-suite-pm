// tests/hse/kpis.test.js
// اختبار صيغ مؤشرات الأداء (بلا قاعدة بيانات) - البند 16.
// تشغيل: node --test tests/hse/kpis.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeIncidentFrequencyRate, computeSeverityRate, computeClosureRate,
  computeTrainingComplianceRate, computeOverallComplianceScore,
} from '../../lib/hse/kpis.js';

describe('معدل تكرار الحوادث', () => {
  test('حادثان خلال 500,000 ساعة عمل = معدل 4', () => {
    assert.equal(computeIncidentFrequencyRate({ recordableIncidents: 2, totalManHours: 500_000 }), 4);
  });
  test('صفر ساعات عمل يعيد null بدل قسمة على صفر', () => {
    assert.equal(computeIncidentFrequencyRate({ recordableIncidents: 3, totalManHours: 0 }), null);
  });
  test('صفر حوادث يعيد صفراً حقيقياً (وليس null)', () => {
    assert.equal(computeIncidentFrequencyRate({ recordableIncidents: 0, totalManHours: 100_000 }), 0);
  });
});

describe('معدل شدة الإصابات', () => {
  test('10 أيام فقد خلال مليون ساعة = معدل 10', () => {
    assert.equal(computeSeverityRate({ totalLostDays: 10, totalManHours: 1_000_000 }), 10);
  });
  test('بلا ساعات عمل مسجّلة يعيد null', () => {
    assert.equal(computeSeverityRate({ totalLostDays: 5, totalManHours: null }), null);
  });
});

describe('نسبة إغلاق الملاحظات', () => {
  test('7 من 10 مغلقة = 70%', () => {
    assert.equal(computeClosureRate({ closedCount: 7, totalCount: 10 }), 70);
  });
  test('بلا ملاحظات إطلاقاً يعيد null (وليس صفراً مضللاً)', () => {
    assert.equal(computeClosureRate({ closedCount: 0, totalCount: 0 }), null);
  });
});

describe('نسبة الالتزام بالتدريب', () => {
  test('18 شهادة سارية من 20 مطلوبة = 90%', () => {
    assert.equal(computeTrainingComplianceRate({ validCertifications: 18, totalRequired: 20 }), 90);
  });
});

describe('مؤشر الالتزام العام بالسلامة', () => {
  test('متوسط ثلاثة مكوّنات متاحة', () => {
    const score = computeOverallComplianceScore({ closureRate: 80, inspectionOnTimeRate: 90, trainingComplianceRate: 100 });
    assert.equal(score, 90);
  });
  test('يتجاهل المكوّنات غير المتاحة (null) بدل معاملتها كصفر', () => {
    const score = computeOverallComplianceScore({ closureRate: 80, inspectionOnTimeRate: null, trainingComplianceRate: null });
    assert.equal(score, 80);
  });
  test('بلا أي بيانات متاحة يعيد null', () => {
    assert.equal(computeOverallComplianceScore({ closureRate: null, inspectionOnTimeRate: null, trainingComplianceRate: null }), null);
  });
});
