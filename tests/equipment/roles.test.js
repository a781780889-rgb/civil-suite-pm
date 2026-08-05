// tests/equipment/roles.test.js
// اختبار صلاحيات القسم السابع المُضافة إلى lib/pm/roles.js المشترك.
// تشغيل: node --test tests/equipment/roles.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { can, assertPermission, PmPermissionError, ROLES, MODULES } from '../../lib/pm/roles.js';

const EQUIP_MODULES = ['equipment', 'equipment_operation', 'equipment_maintenance', 'equipment_spare_part', 'equipment_operator', 'equipment_rental'];

describe('القسم السابع: نظام إدارة المعدات — صلاحيات الوحدات', () => {
  test('الوحدات الست الجديدة مسجّلة في MODULES', () => {
    for (const m of EQUIP_MODULES) assert.ok(MODULES.includes(m), m);
  });

  test('الأدوار الأربعة الجديدة مسجّلة في ROLES', () => {
    const keys = ROLES.map((r) => r.key);
    for (const r of ['equipment_manager', 'maintenance_officer', 'warehouse_keeper', 'operator']) {
      assert.ok(keys.includes(r), r);
    }
  });

  test('مدير المعدات يملك صلاحية كاملة واعتماد على كل وحدات المعدات', () => {
    for (const mod of EQUIP_MODULES) {
      assert.equal(can('equipment_manager', mod, 'delete'), true, mod);
      assert.equal(can('equipment_manager', mod, 'approve'), true, mod);
    }
  });

  test('أمين المخزن له صلاحية كاملة على قطع الغيار فقط، ولا يعدّل التشغيل أو الصيانة', () => {
    assert.equal(can('warehouse_keeper', 'equipment_spare_part', 'delete'), true);
    assert.equal(can('warehouse_keeper', 'equipment_operation', 'edit'), false);
    assert.equal(can('warehouse_keeper', 'equipment_maintenance', 'edit'), false);
  });

  test('مسؤول الصيانة يعتمد سجلات الصيانة لكن لا صلاحية له على عقود الإيجار', () => {
    assert.equal(can('maintenance_officer', 'equipment_maintenance', 'approve'), true);
    assert.equal(can('maintenance_officer', 'equipment_rental', 'view'), false);
  });

  test('المشغل يسجّل عمليات تشغيل فقط، بلا صلاحية إدارية على سجل المعدات نفسه', () => {
    assert.equal(can('operator', 'equipment_operation', 'create'), true);
    assert.equal(can('operator', 'equipment', 'edit'), false);
    assert.equal(can('operator', 'equipment', 'delete'), false);
  });

  test('العامل (worker) والعميل (client) لا صلاحية تعديل لهما على أي وحدة معدات', () => {
    for (const role of ['worker', 'client']) {
      for (const mod of EQUIP_MODULES) {
        assert.equal(can(role, mod, 'edit'), false, `${role}/${mod}`);
      }
    }
  });

  test('فحوصات السلامة تُدار عبر وحدة "safety" الموجودة أصلاً - مسؤول السلامة يعتمدها', () => {
    assert.equal(can('safety_officer', 'safety', 'approve'), true);
  });

  test('مدير النظام يملك كل الصلاحيات على وحدات المعدات الجديدة أيضاً', () => {
    for (const mod of EQUIP_MODULES) assert.equal(can('system_admin', mod, 'delete'), true, mod);
  });

  test('assertPermission يرمي عند غياب صلاحية المعدات', () => {
    assert.throws(() => assertPermission('worker', 'equipment', 'delete'), PmPermissionError);
  });

  test('إجمالي عدد الوحدات أصبح 29 (13 قسم رابع/خامس + 10 أعمال + 6 معدات)', () => {
    assert.equal(MODULES.length, 29);
  });
});
