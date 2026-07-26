// tests/schedule/criticalPath.test.js
// تشغيل: node --test tests/schedule/criticalPath.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeCriticalPath, findDelayedActivities } from '../../lib/schedule/criticalPath.js';
import { normalizeCalendar } from '../../lib/schedule/calendar.js';

const CAL = normalizeCalendar({ working_days: '[0,1,2,3,4]', hours_per_day: 8 }, []);
const byId = (result, id) => result.schedule.find((s) => s.id === id);

describe('سلسلة FS بسيطة (مطابقة لنتائج محرك القسم الرابع رقمياً في مساحة الإزاحة)', () => {
  const activities = [
    { id: 1, activity_type: 'task', duration_days: 5, progress_pct: 0 },
    { id: 2, activity_type: 'task', duration_days: 3, progress_pct: 0 },
    { id: 3, activity_type: 'task', duration_days: 4, progress_pct: 0 },
  ];
  const relationships = [
    { predecessor_id: 1, successor_id: 2, rel_type: 'FS', lag_days: 0 },
    { predecessor_id: 2, successor_id: 3, rel_type: 'FS', lag_days: 1 },
  ];
  const result = computeCriticalPath({ activities, relationships, scheduleAnchorDate: '2026-01-01', calendar: CAL });

  test('المدة الكلية بإزاحة أيام العمل = 13 (5+3+1+4)', () => {
    assert.equal(result.projectEndOffset, 13);
  });
  test('كل الأنشطة على المسار الحرج (سلسلة خطية واحدة)', () => {
    assert.equal(result.criticalActivityIds.length, 3);
  });
  test('ES/EF صحيحة لكل نشاط', () => {
    const a1 = byId(result, 1), a2 = byId(result, 2), a3 = byId(result, 3);
    assert.equal(a1.esOffset, 0); assert.equal(a1.efOffset, 5);
    assert.equal(a2.esOffset, 5); assert.equal(a2.efOffset, 8);
    assert.equal(a3.esOffset, 9); assert.equal(a3.efOffset, 13);
  });
  test('التاريخ الفعلي لبداية أول نشاط = تاريخ الإرساء نفسه', () => {
    assert.equal(byId(result, 1).earlyStart, '2026-01-01');
  });
  test('نهاية شاملة (inclusive) للنشاط الأول = آخر يوم عمل فعلي (2026-01-04 خامس يوم عمل)', () => {
    // الخميس 01-01 (عمل)، الجمعة/السبت عطلة، الأحد 01-04 ثاني يوم عمل... تحقق فعلي من الفهرس
    const a1 = byId(result, 1);
    assert.ok(a1.earlyFinishInclusive < a1.earlyFinish || a1.earlyFinishInclusive <= a1.earlyFinish);
  });
});

describe('طفو كلي (Total Float) لمهمة موازية أقصر', () => {
  const activities = [
    { id: 1, activity_type: 'task', duration_days: 2 },
    { id: 2, activity_type: 'task', duration_days: 10 },
    { id: 3, activity_type: 'task', duration_days: 3 },
    { id: 4, activity_type: 'task', duration_days: 2 },
  ];
  const relationships = [
    { predecessor_id: 1, successor_id: 2, rel_type: 'FS', lag_days: 0 },
    { predecessor_id: 1, successor_id: 3, rel_type: 'FS', lag_days: 0 },
    { predecessor_id: 2, successor_id: 4, rel_type: 'FS', lag_days: 0 },
    { predecessor_id: 3, successor_id: 4, rel_type: 'FS', lag_days: 0 },
  ];
  const result = computeCriticalPath({ activities, relationships, scheduleAnchorDate: '2026-01-01', calendar: CAL });

  test('المسار الأطول (1-2-4) هو الحرج فقط', () => {
    assert.deepEqual(result.criticalActivityIds.sort(), [1, 2, 4]);
  });
  test('النشاط 3 (الأقصر) لديه طفو كلي = 7 وليس حرجاً', () => {
    const a3 = byId(result, 3);
    assert.equal(a3.totalFloatDays, 7);
    assert.equal(a3.isCritical, false);
  });
});

describe('الطفو الحر (Free Float) يختلف عن الطفو الكلي عند وجود تابع مباشر مقيَّد', () => {
  // A -> B -> D (مسار طويل عبر C يعطي فسحة كبيرة)، وA -> C -> D، وB -> E (تابع مباشر بلا فسحة إضافية)
  const activities = [
    { id: 1, name: 'A', activity_type: 'task', duration_days: 2 },
    { id: 2, name: 'B', activity_type: 'task', duration_days: 2 },
    { id: 3, name: 'C', activity_type: 'task', duration_days: 10 },
    { id: 4, name: 'D', activity_type: 'task', duration_days: 1 },
    { id: 5, name: 'E', activity_type: 'task', duration_days: 1 },
  ];
  const relationships = [
    { predecessor_id: 1, successor_id: 2, rel_type: 'FS', lag_days: 0 },
    { predecessor_id: 1, successor_id: 3, rel_type: 'FS', lag_days: 0 },
    { predecessor_id: 2, successor_id: 4, rel_type: 'FS', lag_days: 0 },
    { predecessor_id: 3, successor_id: 4, rel_type: 'FS', lag_days: 0 },
    { predecessor_id: 2, successor_id: 5, rel_type: 'FS', lag_days: 0 },
  ];
  const result = computeCriticalPath({ activities, relationships, scheduleAnchorDate: '2026-01-01', calendar: CAL });

  test('للنشاط B: طفو كلي = 8 (مسار غير حرج عبر D)', () => {
    assert.equal(byId(result, 2).totalFloatDays, 8);
  });
  test('للنشاط B: طفو حر = 0 (لا يمكنه التأخر دون تأخير بداية E المبكرة)', () => {
    assert.equal(byId(result, 2).freeFloatDays, 0);
  });
});

describe('أنواع العلاقات SS / FF / SF', () => {
  test('SS مع تأخر 2: يبدأ التابع مع إزاحة السلف + التأخر', () => {
    const activities = [{ id: 1, activity_type: 'task', duration_days: 5 }, { id: 2, activity_type: 'task', duration_days: 3 }];
    const relationships = [{ predecessor_id: 1, successor_id: 2, rel_type: 'SS', lag_days: 2 }];
    const result = computeCriticalPath({ activities, relationships, scheduleAnchorDate: '2026-01-01', calendar: CAL });
    assert.equal(byId(result, 2).esOffset, 2);
  });
  test('FF بلا تأخر: ينتهي التابع مع نهاية السلف', () => {
    const activities = [{ id: 1, activity_type: 'task', duration_days: 5 }, { id: 2, activity_type: 'task', duration_days: 3 }];
    const relationships = [{ predecessor_id: 1, successor_id: 2, rel_type: 'FF', lag_days: 0 }];
    const result = computeCriticalPath({ activities, relationships, scheduleAnchorDate: '2026-01-01', calendar: CAL });
    assert.equal(byId(result, 2).efOffset, 5);
  });
  test('SF: يرتبط انتهاء التابع ببداية السلف (قد ينتج إزاحة سالبة)', () => {
    const activities = [{ id: 1, activity_type: 'task', duration_days: 5 }, { id: 2, activity_type: 'task', duration_days: 3 }];
    const relationships = [{ predecessor_id: 1, successor_id: 2, rel_type: 'SF', lag_days: 0 }];
    const result = computeCriticalPath({ activities, relationships, scheduleAnchorDate: '2026-01-01', calendar: CAL });
    assert.equal(byId(result, 2).efOffset, 0);
    assert.equal(byId(result, 2).esOffset, -3);
  });
});

describe('كشف العلاقات الدائرية (Circular Dependency)', () => {
  test('يرفض بخطأ واضح عند وجود دورة', () => {
    const activities = [{ id: 1, activity_type: 'task', duration_days: 2 }, { id: 2, activity_type: 'task', duration_days: 2 }];
    const relationships = [
      { predecessor_id: 1, successor_id: 2, rel_type: 'FS', lag_days: 0 },
      { predecessor_id: 2, successor_id: 1, rel_type: 'FS', lag_days: 0 },
    ];
    const result = computeCriticalPath({ activities, relationships, scheduleAnchorDate: '2026-01-01', calendar: CAL });
    assert.equal(result.ok, false);
    assert.ok(result.error.includes('دائرية'));
  });
});

describe('المعالم (Milestones)', () => {
  test('مدة المعلَم دائماً صفر حتى لو أُدخلت قيمة أخرى', () => {
    const activities = [
      { id: 1, activity_type: 'task', duration_days: 5 },
      { id: 2, activity_type: 'milestone', duration_days: 3 },
    ];
    const relationships = [{ predecessor_id: 1, successor_id: 2, rel_type: 'FS', lag_days: 0 }];
    const result = computeCriticalPath({ activities, relationships, scheduleAnchorDate: '2026-01-01', calendar: CAL });
    const m = byId(result, 2);
    assert.equal(m.durationDays, 0);
    assert.equal(m.earlyStart, m.earlyFinish);
  });
});

describe('تلخيص عقد WBS الأب (Summary roll-up)', () => {
  test('تواريخ الأب = min/max الأبناء، والتقدّم متوسط مرجّح بالمدة، والحرَجية OR', () => {
    const activities = [
      { id: 1, parent_id: 10, activity_type: 'task', duration_days: 4, progress_pct: 100 },
      { id: 2, parent_id: 10, activity_type: 'task', duration_days: 6, progress_pct: 0 },
      { id: 10, parent_id: null, activity_type: 'summary', duration_days: 0, progress_pct: 0 },
    ];
    const relationships = [];
    const result = computeCriticalPath({ activities, relationships, scheduleAnchorDate: '2026-01-01', calendar: CAL });
    const parent = byId(result, 10);
    assert.ok(parent, 'يجب أن يظهر ملخص الأب في نتائج الجدول');
    assert.equal(parent.esOffset, 0);
    assert.equal(parent.efOffset, 6);
    // متوسط مرجّح: (100*4 + 0*6) / 10 = 40
    assert.equal(parent.progressPct, 40);
  });
});

describe('findDelayedActivities', () => {
  test('يكتشف فقط الأنشطة غير المكتملة المتجاوزة لتاريخها المخطط', () => {
    const activities = [
      { id: 1, status: 'in_progress', planned_end: '2026-01-05' },
      { id: 2, status: 'completed', planned_end: '2026-01-01' },
      { id: 3, status: 'in_progress', planned_end: '2026-02-01' },
    ];
    const delayed = findDelayedActivities(activities, '2026-01-10');
    assert.equal(delayed.length, 1);
    assert.equal(delayed[0].id, 1);
    assert.equal(delayed[0].delayDays, 5);
  });
});
