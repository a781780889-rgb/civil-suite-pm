// tests/equipment/db.test.js
// اختبار تكامل حقيقي (SQLite فعلية، بلا محاكاة) للسيناريو الكامل المطلوب صراحة في القسم
// السابع - البند 29 (قواعد الاختبار):
// إضافة معدة → تعيينها لمشروع → حجزها → تشغيلها → تسجيل الوقود → تسجيل ساعات التشغيل →
// ظهور موعد الصيانة → تسجيل الصيانة → حساب التكلفة → تحديث الميزانية → ظهور النتائج بالتقارير.
// + اختبارات مستقلة لكل بند من بنود 29 الأخرى: المعدات المؤجرة، نقل المعدات، تعارض الحجوزات،
// الأعطال، المشغلين غير المؤهلين، قطع الغيار، الصلاحيات، التكامل مع الميزانية.
// تشغيل: node --test tests/equipment/db.test.js
// ملاحظة: يستخدم نفس data/civil-suite.sqlite3 الموحّد (كبقية اختبارات tests/pm وtests/business)،
// وليس ملفاً يُشحن مع التسليم - سيُنشأ تلقائياً عند أول تشغيل حقيقي (npm install ثم node --test).
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { EquipConflictError } from '../../lib/equipment/apiHelpers.js';
import { ValidationError } from '../../lib/calc/common.js';
import { PmPermissionError, assertPermission } from '../../lib/pm/roles.js';

let equipmentDb, categories, assignments, reservations, operations, hourMeter, fuel, maintenance, breakdowns, spareParts, operators, transfers, rentals, costs, dashboard, projects, budget;

before(async () => {
  equipmentDb = await import('../../lib/equipment/db/equipment.js');
  categories = await import('../../lib/equipment/db/categories.js');
  assignments = await import('../../lib/equipment/db/assignments.js');
  reservations = await import('../../lib/equipment/db/reservations.js');
  operations = await import('../../lib/equipment/db/operations.js');
  hourMeter = await import('../../lib/equipment/db/hourMeter.js');
  fuel = await import('../../lib/equipment/db/fuel.js');
  maintenance = await import('../../lib/equipment/db/maintenance.js');
  breakdowns = await import('../../lib/equipment/db/breakdowns.js');
  spareParts = await import('../../lib/equipment/db/spareParts.js');
  operators = await import('../../lib/equipment/db/operators.js');
  transfers = await import('../../lib/equipment/db/transfers.js');
  rentals = await import('../../lib/equipment/db/rentals.js');
  costs = await import('../../lib/equipment/db/costs.js');
  dashboard = await import('../../lib/equipment/db/dashboard.js');
  projects = await import('../../lib/pm/db/projects.js');
  budget = await import('../../lib/pm/db/budget.js');
});

describe('دورة حياة معدة كاملة: إضافة ← تعيين ← حجز ← تشغيل ← وقود ← صيانة ← تكلفة ← ميزانية ← تقارير', () => {
  let projectId, equipmentId, operatorId, scheduleId, maintenanceRecordId;

  test('إنشاء مشروع اختبار حقيقي', () => {
    const p = projects.createProjectFull({ name: 'مشروع اختبار المعدات', project_code: `TESTEQ-${Date.now()}`, budget: 500000, status: 'in_progress', start_date: '2026-01-01', actor: 'test' });
    projectId = p.id;
    assert.ok(projectId > 0);
  });

  test('إضافة معدة جديدة برقم فريد يُولَّد تلقائياً، وربطها بتصنيف حقيقي', () => {
    const cats = categories.listCategories({ group_key: 'drilling' });
    assert.ok(cats.length > 0, 'يجب أن تكون تصنيفات الحفر مزروعة مسبقاً عبر schema.js');
    const eq = equipmentDb.createEquipment({
      name: 'حفارة اختبار CAT 320', category_key: cats[0].key, manufacturer: 'Caterpillar', manufacture_year: 2022,
      purchase_date: '2024-01-01', purchase_price: 120000, salvage_value: 12000, useful_life_years: 10,
      rated_consumption_l_per_hour: 12, current_location: 'الموقع الرئيسي', ownership_type: 'owned',
    }, 'test');
    equipmentId = eq.id;
    assert.ok(eq.equipment_code.startsWith('EQ-'));
    assert.equal(eq.status, 'available');
  });

  test('منع إضافة معدة برقم مكرر', () => {
    const dup = equipmentDb.getEquipmentById(equipmentId);
    assert.throws(() => equipmentDb.createEquipment({ name: 'نسخة مكررة', equipment_code: dup.equipment_code, category_key: dup.category_key }, 'test'), ValidationError);
  });

  test('إضافة مشغل مؤهل وتفويضه على هذه المعدة تحديداً', () => {
    const eq = equipmentDb.getEquipmentById(equipmentId);
    const op = operators.createOperator({ name: 'مشغل اختبار', license_no: 'LIC-1', license_expiry: '2030-01-01', allowed_categories: [] }, 'test');
    operatorId = op.id;
    operators.authorizeOperator(operatorId, equipmentId, 'تفويض اختبار', 'test');
    const check = operators.checkOperatorAuthorization(operatorId, equipmentId);
    assert.equal(check.authorized, true);
  });

  test('منع تعيين مشغل غير مؤهل عند تسجيل تشغيل', () => {
    const unqualified = operators.createOperator({ name: 'مشغل غير مؤهل' }, 'test');
    assert.throws(() => operations.createOperationLog({ equipment_id: equipmentId, log_date: '2026-02-01', hours: 2, operator_id: unqualified.id }, 'test'), ValidationError);
  });

  test('تعيينها لمشروع (تخصيص) — تُحدَّث حالة المعدة إلى قيد التشغيل تلقائياً', () => {
    const a = assignments.createAssignment({ equipment_id: equipmentId, project_id: projectId, start_date: '2026-02-01', end_date: '2026-02-20', operator_id: operatorId }, 'test');
    assert.equal(a.status, 'active');
    const eq = equipmentDb.getEquipmentById(equipmentId);
    assert.equal(eq.status, 'in_use');
    assert.equal(eq.current_project_id, projectId);
  });

  test('حجزها لفترة لاحقة غير متعارضة مع التخصيص الحالي', () => {
    const r = reservations.createReservation({ equipment_id: equipmentId, project_id: projectId, start_date: '2026-03-01', end_date: '2026-03-05', activity: 'صب خرسانة' }, 'test');
    assert.equal(r.status, 'pending');
  });

  test('تشغيلها: تسجيل ساعات التشغيل تلقائياً من وقت البداية والنهاية، وتحديث عداد الساعات', () => {
    const log = operations.createOperationLog({
      equipment_id: equipmentId, project_id: projectId, operator_id: operatorId, log_date: '2026-02-02',
      start_time: '07:00', end_time: '15:00', activity: 'حفر أساسات', end_hour_meter: 8,
    }, 'test');
    assert.equal(log.hours, 8);
    const eq = equipmentDb.getEquipmentById(equipmentId);
    assert.equal(eq.current_hour_meter, 8);
  });

  test('تسجيل الوقود: يحسب التكلفة الإجمالية تلقائياً ويربطها بميزانية المشروع الحقيقية', () => {
    const before = budget.listBudgetItems({ project_id: projectId, item_type: 'expense' });
    const log = fuel.createFuelLog({ equipment_id: equipmentId, project_id: projectId, fill_date: '2026-02-02', quantity_l: 100, price_per_liter: 2.5 }, 'test');
    assert.equal(log.total_cost, 250);
    const after = budget.listBudgetItems({ project_id: projectId, item_type: 'expense' });
    assert.equal(after.length, before.length + 1, 'يجب أن يظهر بند مصروف وقود جديد في ميزانية المشروع فعلياً');
    assert.ok(after.some((b) => b.reference_no === `FUEL-${log.id}`));
  });

  test('ظهور موعد صيانة: إنشاء جدول صيانة دورية بالساعات، والتحقق من أنه ضمن قائمة المستحقات', () => {
    const s = maintenance.createSchedule({ equipment_id: equipmentId, title: 'تغيير زيت المحرك', interval_type: 'hours', interval_hours: 5, last_done_hour_meter: 0 }, 'test');
    scheduleId = s.id;
    assert.equal(s.next_due_hour_meter, 5);
    const due = maintenance.listDueSchedules();
    assert.ok(due.some((d) => d.id === scheduleId), 'عداد الساعات الحالي (8) تجاوز حد الاستحقاق (5) فيجب ظهورها في المستحقات');
  });

  test('تسجيل الصيانة: يحسب التكلفة، يحدّث next_due في الجدول، ويربط التكلفة بالميزانية', () => {
    const rec = maintenance.createMaintenanceRecord({
      equipment_id: equipmentId, project_id: projectId, schedule_id: scheduleId, maintenance_type: 'preventive',
      title: 'تغيير زيت المحرك', maintenance_date: '2026-02-05', hour_meter_at_service: 8, labor_cost: 150, status: 'completed',
    }, 'test');
    maintenanceRecordId = rec.id;
    assert.equal(rec.total_cost, 150);
    const updatedSchedule = maintenance.listSchedules({ equipment_id: equipmentId })[0];
    assert.equal(updatedSchedule.last_done_hour_meter, 8);
    assert.equal(updatedSchedule.next_due_hour_meter, 13); // 8 + 5
    const budgetItems = budget.listBudgetItems({ project_id: projectId, item_type: 'expense' });
    assert.ok(budgetItems.some((b) => b.reference_no === `MAINT-${maintenanceRecordId}`));
  });

  test('حساب التكلفة الإجمالية للمعدة: يجمع الوقود والصيانة والإهلاك بشكل صحيح', () => {
    const summary = costs.computeEquipmentCostSummary(equipmentId);
    assert.equal(summary.fuel_cost, 250);
    assert.equal(summary.maintenance_cost, 150);
    assert.ok(summary.total_cost >= 400);
    assert.equal(summary.cost_per_hour, Math.round((summary.total_cost / 8) * 100) / 100);
  });

  test('ظهور النتائج في لوحة التحكم الرئيسية (تجميع حقيقي عبر كل الجداول)', () => {
    const stats = dashboard.getDashboardStats();
    assert.ok(stats.total_equipment >= 1);
    assert.ok(stats.total_operating_hours >= 8);
    assert.ok(stats.recent_operations.some((o) => o.equipment_name === 'حفارة اختبار CAT 320'));
  });
});

describe('منع تعارض الحجوزات (البند 6)', () => {
  let equipmentId, projectId;
  before(() => {
    const cats = categories.listCategories();
    const p = projects.createProjectFull({ name: 'مشروع اختبار التعارض', project_code: `TESTCONF-${Date.now()}`, actor: 'test' });
    projectId = p.id;
    const eq = equipmentDb.createEquipment({ name: 'شاحنة اختبار التعارض', category_key: cats[0].key }, 'test');
    equipmentId = eq.id;
    reservations.createReservation({ equipment_id: equipmentId, project_id: projectId, start_date: '2026-05-01', end_date: '2026-05-10' }, 'test');
  });

  test('حجز متداخل زمنياً لنفس المعدة يُرفض بخطأ EquipConflictError واضح', () => {
    assert.throws(
      () => reservations.createReservation({ equipment_id: equipmentId, project_id: projectId, start_date: '2026-05-05', end_date: '2026-05-15' }, 'test'),
      EquipConflictError
    );
  });

  test('حجز في فترة غير متداخلة يُقبل بنجاح', () => {
    const r = reservations.createReservation({ equipment_id: equipmentId, project_id: projectId, start_date: '2026-06-01', end_date: '2026-06-05' }, 'test');
    assert.ok(r.id > 0);
  });
});

describe('الأعطال: تسجيل، حساب Downtime تلقائياً، وتحديث الحالة (البند 12)', () => {
  let equipmentId;
  before(() => {
    const cats = categories.listCategories();
    const eq = equipmentDb.createEquipment({ name: 'رافعة اختبار الأعطال', category_key: cats[0].key }, 'test');
    equipmentId = eq.id;
    equipmentDb.changeEquipmentStatus(equipmentId, 'in_use', 'بدء اختبار', 'test');
  });

  test('تسجيل عطل جديد ينقل حالة المعدة إلى "في الصيانة" تلقائياً', () => {
    const b = breakdowns.createBreakdown({ equipment_id: equipmentId, description: 'تسريب زيت هيدروليكي', severity: 'high', breakdown_date: '2026-02-10', stop_time: '2026-02-10T08:00:00' }, 'test');
    assert.equal(b.status, 'open');
    assert.ok(b.report_no.startsWith('BRK-'));
    const eq = equipmentDb.getEquipmentById(equipmentId);
    assert.equal(eq.status, 'maintenance');
    return b;
  });

  test('إصلاح العطل يحسب ساعات التوقف تلقائياً ويعيد المعدة إلى "متاحة"', () => {
    const open = breakdowns.listOpenBreakdowns().find((b) => b.equipment_id === equipmentId);
    const resolved = breakdowns.resolveBreakdown(open.id, { resume_time: '2026-02-10T12:00:00', corrective_action: 'استبدال الخرطوم', labor_cost: 200 }, 'test');
    assert.equal(resolved.downtime_hours, 4);
    assert.equal(resolved.status, 'resolved');
    const eq = equipmentDb.getEquipmentById(equipmentId);
    assert.equal(eq.status, 'available');
  });
});

describe('قطع الغيار: المخزون وخصم الاستخدام (البند 13)', () => {
  test('استخدام قطعة يخصم الكمية تلقائياً ويكتشف انخفاض المخزون', () => {
    const part = spareParts.createPart({ part_name: 'فلتر زيت اختبار', quantity_on_hand: 5, min_stock: 3, unit_price: 40 }, 'test');
    const cats = categories.listCategories();
    const eq = equipmentDb.createEquipment({ name: 'معدة اختبار قطع الغيار', category_key: cats[0].key }, 'test');
    const rec = maintenance.createMaintenanceRecord({ equipment_id: eq.id, title: 'صيانة اختبار', maintenance_date: '2026-02-11', parts: [{ part_id: part.id, quantity: 3 }] }, 'test');
    assert.equal(rec.parts_cost, 120);
    const updatedPart = spareParts.getPartById(part.id);
    assert.equal(updatedPart.quantity_on_hand, 2); // 5 - 3 = 2 <= الحد الأدنى 3 -> تنبيه منخفض
  });
});

describe('المعدات المؤجرة والنقل (البندان 17-18)', () => {
  let equipmentId;
  before(() => {
    const cats = categories.listCategories();
    const eq = equipmentDb.createEquipment({ name: 'خلاطة اختبار الإيجار', category_key: cats[0].key, ownership_type: 'rented' }, 'test');
    equipmentId = eq.id;
  });

  test('إنشاء عقد إيجار وربطه بالمعدة', () => {
    const r = rentals.createRental({ equipment_id: equipmentId, rental_company: 'شركة تأجير اختبار', rental_start: '2026-01-01', rental_end: '2026-12-31', rental_cost_total: 30000 }, 'test');
    assert.equal(r.contract_status, 'active');
  });

  test('نقل المعدة بين المواقع يحدّث الموقع الحالي تلقائياً بعد الاكتمال', () => {
    const t = transfers.createTransfer({ equipment_id: equipmentId, to_location: 'موقع فرعي 2', transfer_date: '2026-02-12' }, 'test');
    transfers.completeTransfer(t.id, 'test');
    const eq = equipmentDb.getEquipmentById(equipmentId);
    assert.equal(eq.current_location, 'موقع فرعي 2');
  });
});

describe('عداد الساعات: منع الرجوع للخلف بلا صلاحية خاصة (البند 8)', () => {
  test('قراءة أقل من السابقة بلا سبب تعديل تُرفض', () => {
    const cats = categories.listCategories();
    const eq = equipmentDb.createEquipment({ name: 'معدة اختبار العداد', category_key: cats[0].key }, 'test');
    hourMeter.recordHourMeterReading(eq.id, 100, { source: 'manual' });
    assert.throws(() => hourMeter.recordHourMeterReading(eq.id, 50, { source: 'manual' }), ValidationError);
    assert.throws(() => hourMeter.recordHourMeterReading(eq.id, 50, { source: 'manual', allowBackward: true }), ValidationError); // بلا سبب موثّق
    const withReason = hourMeter.recordHourMeterReading(eq.id, 50, { source: 'manual', allowBackward: true, overrideReason: 'استبدال العداد التالف' });
    assert.equal(withReason.reading_value, 50);
  });
});

describe('الصلاحيات (RBAC) على مسارات المعدات', () => {
  test('العامل (worker) لا يملك صلاحية إضافة معدة', () => {
    assert.throws(() => assertPermission('worker', 'equipment', 'create'), PmPermissionError);
  });
  test('مدير المعدات يملك صلاحية إضافة معدة', () => {
    assert.doesNotThrow(() => assertPermission('equipment_manager', 'equipment', 'create'));
  });
});
