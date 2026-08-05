// tests/equipment/conflicts.test.js
// اختبار منطق كشف التعارض الزمني بين الحجوزات/التخصيص (البند 6).
// تشغيل: node --test tests/equipment/conflicts.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { rangesOverlap, findOverlaps } from '../../lib/equipment/conflicts.js';

describe('rangesOverlap', () => {
  test('فترتان متداخلتان جزئياً تتعارضان', () => {
    assert.equal(rangesOverlap('2026-03-01', '2026-03-10', '2026-03-05', '2026-03-15'), true);
  });
  test('فترتان منفصلتان تماماً لا تتعارضان', () => {
    assert.equal(rangesOverlap('2026-03-01', '2026-03-05', '2026-03-10', '2026-03-15'), false);
  });
  test('فترة مفتوحة النهاية (تخصيص نشط بلا end_date) تتعارض مع أي حجز مستقبلي', () => {
    assert.equal(rangesOverlap('2026-01-01', null, '2026-06-01', '2026-06-10'), true);
  });
  test('فترتان متلاصقتان (نهاية الأولى = بداية الثانية) تُعتبران متعارضتين (يوم مشترك)', () => {
    assert.equal(rangesOverlap('2026-03-01', '2026-03-10', '2026-03-10', '2026-03-15'), true);
  });
});

describe('findOverlaps', () => {
  const candidates = [
    { id: 1, start_date: '2026-03-01', end_date: '2026-03-10' },
    { id: 2, start_date: '2026-04-01', end_date: '2026-04-10' },
  ];
  test('يعيد فقط السجلات المتداخلة فعلياً', () => {
    const overlaps = findOverlaps(candidates, '2026-03-05', '2026-03-06');
    assert.equal(overlaps.length, 1);
    assert.equal(overlaps[0].id, 1);
  });
  test('يستثني السجل الحالي نفسه عند التعديل (excludeId)', () => {
    const overlaps = findOverlaps(candidates, '2026-03-05', '2026-03-06', 1);
    assert.equal(overlaps.length, 0);
  });
  test('لا تعارض يعيد مصفوفة فارغة', () => {
    assert.equal(findOverlaps(candidates, '2026-05-01', '2026-05-05').length, 0);
  });
});
