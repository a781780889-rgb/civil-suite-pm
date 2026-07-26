// tests/schedule/calendar.test.js
// تشغيل: node --test tests/schedule/calendar.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCalendar, DEFAULT_CALENDAR, isWorkingDay, snapToWorkingDay,
  buildCalendarIndex, countWorkingDaysBetween,
} from '../../lib/schedule/calendar.js';

describe('isWorkingDay — التقويم الافتراضي (أحد-خميس)', () => {
  test('الخميس 2026-01-01 يوم عمل', () => {
    assert.equal(isWorkingDay(DEFAULT_CALENDAR, '2026-01-01'), true);
  });
  test('الجمعة 2026-01-02 عطلة', () => {
    assert.equal(isWorkingDay(DEFAULT_CALENDAR, '2026-01-02'), false);
  });
  test('السبت 2026-01-03 عطلة', () => {
    assert.equal(isWorkingDay(DEFAULT_CALENDAR, '2026-01-03'), false);
  });
  test('الأحد 2026-01-04 يوم عمل', () => {
    assert.equal(isWorkingDay(DEFAULT_CALENDAR, '2026-01-04'), true);
  });
});

describe('الاستثناءات (عطل رسمية / أيام عمل استثنائية)', () => {
  const cal = normalizeCalendar({ working_days: '[0,1,2,3,4]' }, [
    { exception_date: '2026-01-01', is_working: 0 }, // عطلة رسمية تقع يوم خميس (عادة يوم عمل)
    { exception_date: '2026-01-02', is_working: 1 }, // يوم عمل استثنائي يقع يوم جمعة (عادة عطلة)
  ]);
  test('العطلة الرسمية تتفوّق على يوم عمل أصلي', () => {
    assert.equal(isWorkingDay(cal, '2026-01-01'), false);
  });
  test('يوم العمل الاستثنائي يتفوّق على عطلة أصلية', () => {
    assert.equal(isWorkingDay(cal, '2026-01-02'), true);
  });
});

describe('snapToWorkingDay', () => {
  test('يقرّب الجمعة للأمام إلى الأحد التالي', () => {
    assert.equal(snapToWorkingDay(DEFAULT_CALENDAR, '2026-01-02', 1), '2026-01-04');
  });
});

describe('buildCalendarIndex', () => {
  const idx = buildCalendarIndex(DEFAULT_CALENDAR, '2026-01-01');
  test('الإرساء نفسه = إزاحة 0', () => {
    assert.equal(idx.offsetOf('2026-01-01'), 0);
  });
  test('إزاحة 1 = أول يوم عمل تالٍ (الأحد 01-04، متجاوزاً الجمعة والسبت)', () => {
    assert.equal(idx.dateOf(1), '2026-01-04');
  });
  test('إزاحة 2 = الإثنين 01-05', () => {
    assert.equal(idx.dateOf(2), '2026-01-05');
  });
  test('offsetOf يعكس dateOf بشكل متسق (round-trip)', () => {
    assert.equal(idx.offsetOf(idx.dateOf(10)), 10);
  });
  test('إزاحة سالبة تعمل بشكل صحيح', () => {
    const back = idx.dateOf(-1);
    assert.equal(idx.offsetOf(back), -1);
  });
});

describe('countWorkingDaysBetween', () => {
  test('من الخميس إلى الإثنين شاملاً = 3 أيام عمل (الخميس، الأحد، الإثنين)', () => {
    assert.equal(countWorkingDaysBetween(DEFAULT_CALENDAR, '2026-01-01', '2026-01-05'), 3);
  });
});
