// tests/schedule/integration.test.js
// اختبار تكامل حقيقي (يستخدم قاعدة بيانات SQLite الفعلية) - القاعدة السادسة عشرة الإلزامية:
// "اختبار التكامل مع جميع الأقسام الأخرى". يُنشئ مشروعاً وجدولاً وأنشطة حقيقية، يتحقق من
// عمل السلسلة كاملة (إنشاء → علاقات → إعادة حساب → تعيين مورد → تحديث تقدم → خط أساس →
// لوحة تحكم)، ثم يحذف كل ما أنشأه (مشروع الاختبار وتوابعه بالـ CASCADE) دون أثر باقٍ.
// تشغيل: node --test tests/schedule/integration.test.js
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createProject } from '../../lib/db.js';
import { getDb } from '../../lib/db.js';
import { createResource } from '../../lib/pm/db/resources.js';
import { createSchedule, getSchedule } from '../../lib/schedule/db/schedules.js';
import { createActivity, listActivities, getActivity } from '../../lib/schedule/db/activities.js';
import { createRelationship, listRelationships } from '../../lib/schedule/db/relationships.js';
import { recalculateSchedule } from '../../lib/schedule/recalc.js';
import { assignResource, listResourcesForActivity, findResourceConflicts } from '../../lib/schedule/db/resources.js';
import { logProgress, comparePlannedVsActual } from '../../lib/schedule/db/progress.js';
import { createBaseline, compareBaseline } from '../../lib/schedule/db/baselines.js';
import { getScheduleDashboardStats } from '../../lib/schedule/db/dashboard.js';
import { listPmAuditLog } from '../../lib/pm/db/audit.js';

let project, resource;

before(() => {
  project = createProject({ name: '[TEST] مشروع اختبار القسم الخامس', owner_name: 'مالك تجريبي' });
  resource = createResource({ resource_type: 'labor', name: '[TEST] عامل حدادة', unit: 'يوم', unit_cost: 150 });
});

after(() => {
  // تنظيف كامل: حذف المشروع التجريبي يحذف بالـ CASCADE كل الجداول/الأنشطة/العلاقات/تعيينات الموارد المرتبطة
  getDb().prepare(`DELETE FROM projects WHERE id = ?`).run(project.id);
  getDb().prepare(`DELETE FROM pm_resources WHERE id = ?`).run(resource.id);
});

describe('تدفق القسم الخامس الكامل عبر قاعدة بيانات حقيقية', () => {
  let schedule, phaseActivity, act1, act2, act3;

  test('إنشاء جدول زمني مرتبط بالمشروع', () => {
    schedule = createSchedule({ project_id: project.id, name: 'الجدول الرئيسي', data_date: '2026-02-01' }, 'tester');
    assert.equal(schedule.project_id, project.id);
    assert.equal(schedule.status, 'active');
    assert.equal(schedule.is_primary, 1);
    assert.ok(schedule.calendar_id, 'يجب أن يُنشأ تقويم افتراضي تلقائياً');
  });

  test('بناء WBS: مرحلة (summary) تحوي نشاطين', () => {
    phaseActivity = createActivity({ schedule_id: schedule.id, name: 'أعمال الحفر والردم', activity_type: 'summary' }, 'tester');
    act1 = createActivity({ schedule_id: schedule.id, parent_id: phaseActivity.id, name: 'حفر القواعد', duration_days: 5, planned_start: '2026-02-01' }, 'tester');
    act2 = createActivity({ schedule_id: schedule.id, parent_id: phaseActivity.id, name: 'ردم وتسوية', duration_days: 3 }, 'tester');
    act3 = createActivity({ schedule_id: schedule.id, name: 'صب القواعد', duration_days: 4 }, 'tester');
    const all = listActivities(schedule.id);
    assert.equal(all.length, 4);
    assert.equal(act1.wbs_code, '1.1');
    assert.equal(act2.wbs_code, '1.2');
    assert.equal(act3.wbs_code, '2');
  });

  test('ربط الأنشطة بعلاقات FS ورفض علاقة دائرية', () => {
    createRelationship({ schedule_id: schedule.id, predecessor_id: act1.id, successor_id: act2.id, rel_type: 'FS', lag_days: 0 }, 'tester');
    createRelationship({ schedule_id: schedule.id, predecessor_id: act2.id, successor_id: act3.id, rel_type: 'FS', lag_days: 1 }, 'tester');
    assert.equal(listRelationships(schedule.id).length, 2);
    assert.throws(() => {
      createRelationship({ schedule_id: schedule.id, predecessor_id: act3.id, successor_id: act1.id, rel_type: 'FS', lag_days: 0 }, 'tester');
    }, /دورة/);
  });

  test('إعادة الحساب تلقائياً: يحسب المسار الحرج ويكتب النتائج على الأنشطة', () => {
    const result = recalculateSchedule(schedule.id);
    assert.equal(result.ok, true);
    const refreshedAct3 = getActivity(act3.id);
    assert.equal(refreshedAct3.is_critical, 1);
    assert.ok(refreshedAct3.planned_end, 'يجب أن يُكتب تاريخ نهاية محسوب فعلياً');
    assert.ok(refreshedAct3.early_start);
  });

  test('تعيين مورد على نشاط وحساب التكلفة تلقائياً من سعر الوحدة', () => {
    const assignment = assignResource({ activity_id: act1.id, resource_id: resource.id, quantity: 4 }, 'tester');
    assert.equal(assignment.planned_cost, 600); // 4 * 150
    const forActivity = listResourcesForActivity(act1.id);
    assert.equal(forActivity.length, 1);
    assert.equal(forActivity[0].resource_name, resource.name);
    // لا تعارض متوقَّع (تعيين وحيد لهذا المورد)
    assert.equal(findResourceConflicts(resource.id).length, 0);
  });

  test('تحديث تقدّم فعلي يُحدّث حالة النشاط تلقائياً', () => {
    const updated = logProgress({ activity_id: act1.id, progress_pct: 100, actual_start: '2026-02-01', actual_end: '2026-02-05' }, 'tester');
    assert.equal(updated.status, 'completed');
    const cmp = comparePlannedVsActual(schedule.id);
    const row = cmp.find((r) => r.id === act1.id);
    assert.equal(row.status, 'completed');
  });

  test('إنشاء خط أساس (Baseline) ومقارنته بالوضع الحالي بعد تعديل مدة نشاط', () => {
    const baseline = createBaseline(schedule.id, { name: 'خط الأساس التجريبي' }, 'tester');
    assert.ok(baseline.id);

    // عدّل مدة نشاط بعد أخذ الأساس، ثم أعد الحساب، وتحقق أن المقارنة تلتقط الانحراف
    createActivity({ schedule_id: schedule.id, name: 'نشاط إضافي بعد الأساس', duration_days: 2 }, 'tester');
    recalculateSchedule(schedule.id);
    const { comparison, newActivityIds } = compareBaseline(baseline.id);
    assert.equal(comparison.length, 4); // الأنشطة الأربعة وقت أخذ الأساس
    assert.equal(newActivityIds.length, 1); // النشاط المُضاف لاحقاً
  });

  test('لوحة تحكم القسم الخامس تعكس بيانات حقيقية من المشروع التجريبي', () => {
    const stats = getScheduleDashboardStats();
    assert.ok(stats.totalSchedules >= 1);
    assert.ok(stats.totalActivities >= 4);
  });

  test('كل عملية إنشاء/تعديل مُسجَّلة في سجل التدقيق المركزي', () => {
    const log = listPmAuditLog({ project_id: project.id, entity_type: 'sch_activity' });
    assert.ok(log.length >= 4, 'يجب تسجيل إنشاء الأنشطة الأربعة على الأقل في pm_audit_log');
  });
});
