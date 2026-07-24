// tests/pm/criticalPath.test.js
// اختبارات وحدة حقيقية لمحرك المسار الحرج - بلا اتصال قاعدة بيانات.
// تشغيل: node --test tests/pm/criticalPath.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeCriticalPath, findDelayedTasks, addDaysToDateStr } from '../../lib/pm/criticalPath.js';

describe('computeCriticalPath — سلسلة FS بسيطة', () => {
  const tasks = [
    { id: 1, duration_days: 5 }, { id: 2, duration_days: 3 }, { id: 3, duration_days: 4 },
  ];
  const dependencies = [
    { task_id: 2, depends_on_task_id: 1, dep_type: 'FS', lag_days: 0 },
    { task_id: 3, depends_on_task_id: 2, dep_type: 'FS', lag_days: 1 },
  ];
  const result = computeCriticalPath({ tasks, dependencies, projectStartDate: '2026-01-01' });

  test('يحسب المدة الكلية بشكل صحيح (5+3+1+4=13)', () => {
    assert.equal(result.projectDurationDays, 13);
  });
  test('كل المهام على المسار الحرج (سلسلة خطية واحدة)', () => {
    assert.equal(result.criticalPath.length, 3);
  });
  test('يحسب ES/EF بشكل صحيح لكل مهمة', () => {
    const t1 = result.schedule.find((s) => s.id === 1);
    const t2 = result.schedule.find((s) => s.id === 2);
    const t3 = result.schedule.find((s) => s.id === 3);
    assert.equal(t1.esDay, 0); assert.equal(t1.efDay, 5);
    assert.equal(t2.esDay, 5); assert.equal(t2.efDay, 8);
    assert.equal(t3.esDay, 9); assert.equal(t3.efDay, 13); // +1 يوم تأخر (lag)
  });
});

describe('computeCriticalPath — طفو حر (Float) لمهمة موازية', () => {
  // مهمتان (2،3) تعتمدان على المهمة 1 وتصبان في المهمة 4 - إحداهما أقصر فيكون لها طفو
  const tasks = [
    { id: 1, duration_days: 2 }, { id: 2, duration_days: 10 }, { id: 3, duration_days: 3 }, { id: 4, duration_days: 2 },
  ];
  const dependencies = [
    { task_id: 2, depends_on_task_id: 1, dep_type: 'FS' },
    { task_id: 3, depends_on_task_id: 1, dep_type: 'FS' },
    { task_id: 4, depends_on_task_id: 2, dep_type: 'FS' },
    { task_id: 4, depends_on_task_id: 3, dep_type: 'FS' },
  ];
  const result = computeCriticalPath({ tasks, dependencies, projectStartDate: '2026-01-01' });

  test('المسار الأطول (1-2-4) هو الحرج فقط', () => {
    assert.deepEqual(result.criticalPath.sort(), [1, 2, 4]);
  });
  test('المهمة 3 (الأقصر) لديها طفو حر موجب', () => {
    const t3 = result.schedule.find((s) => s.id === 3);
    assert.ok(t3.floatDays > 0);
    assert.equal(t3.isCritical, false);
  });
});

describe('computeCriticalPath — كشف الدورات (Circular Dependency)', () => {
  test('يرفض بخطأ واضح عند وجود دورة', () => {
    const tasks = [{ id: 1, duration_days: 2 }, { id: 2, duration_days: 2 }];
    const dependencies = [
      { task_id: 1, depends_on_task_id: 2, dep_type: 'FS' },
      { task_id: 2, depends_on_task_id: 1, dep_type: 'FS' },
    ];
    const result = computeCriticalPath({ tasks, dependencies, projectStartDate: '2026-01-01' });
    assert.equal(result.ok, false);
    assert.ok(result.error.includes('دوري'));
  });
});

describe('computeCriticalPath — أنواع تبعية SS/FF/SF', () => {
  test('SS: يبدأ التابع مع السلف زائد التأخر', () => {
    const tasks = [{ id: 1, duration_days: 5 }, { id: 2, duration_days: 3 }];
    const dependencies = [{ task_id: 2, depends_on_task_id: 1, dep_type: 'SS', lag_days: 2 }];
    const result = computeCriticalPath({ tasks, dependencies, projectStartDate: '2026-01-01' });
    assert.equal(result.schedule.find((s) => s.id === 2).esDay, 2);
  });
  test('FF: ينتهي التابع مع نهاية السلف زائد التأخر', () => {
    const tasks = [{ id: 1, duration_days: 5 }, { id: 2, duration_days: 3 }];
    const dependencies = [{ task_id: 2, depends_on_task_id: 1, dep_type: 'FF', lag_days: 0 }];
    const result = computeCriticalPath({ tasks, dependencies, projectStartDate: '2026-01-01' });
    assert.equal(result.schedule.find((s) => s.id === 2).efDay, 5);
  });
});

describe('findDelayedTasks', () => {
  test('يكتشف فقط المهام غير المكتملة المتجاوزة لتاريخها المخطط', () => {
    const tasks = [
      { id: 1, status: 'in_progress', planned_end: '2026-01-05' },
      { id: 2, status: 'completed', planned_end: '2026-01-01' }, // مكتملة - تُستثنى
      { id: 3, status: 'in_progress', planned_end: '2026-02-01' }, // لم يحن موعدها بعد
    ];
    const delayed = findDelayedTasks(tasks, '2026-01-10');
    assert.equal(delayed.length, 1);
    assert.equal(delayed[0].id, 1);
    assert.equal(delayed[0].delayDays, 5);
  });
});

describe('addDaysToDateStr', () => {
  test('يضيف أياماً بشكل صحيح عبر حدود الشهر', () => {
    assert.equal(addDaysToDateStr('2026-01-30', 3), '2026-02-02');
  });
});
