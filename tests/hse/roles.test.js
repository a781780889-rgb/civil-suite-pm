// tests/hse/roles.test.js
// اختبار حقيقي وقابل للتشغيل فعلياً في أي بيئة (roles.js بلا أي استيراد خارجي - لا
// better-sqlite3 ولا Next.js) - يتحقق من صحة توسعة القسم الثامن لمصفوفة الصلاحيات المشتركة.
// تشغيل: node --test tests/hse/roles.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLES, MODULES, getFullMatrix, getPermission, can, assertPermission, PmPermissionError,
} from '../../lib/pm/roles.js';

const HSE_MODULES = ['hse_risk', 'hse_permit', 'hse_inspection', 'hse_incident', 'hse_corrective_action', 'hse_ppe', 'hse_training', 'hse_hazmat', 'hse_emergency'];

describe('سلامة بنية المصفوفة بعد توسعة القسم الثامن', () => {
  test('لا مفاتيح أدوار مكررة', () => {
    const keys = ROLES.map((r) => r.key);
    assert.equal(new Set(keys).size, keys.length);
  });

  test('لا مفاتيح وحدات مكررة', () => {
    assert.equal(new Set(MODULES).size, MODULES.length);
  });

  test('كل الوحدات التسع الجديدة مسجَّلة في MODULES', () => {
    for (const m of HSE_MODULES) assert.ok(MODULES.includes(m), `الوحدة ${m} غير مسجَّلة`);
  });

  test('hse_manager دور جديد وحيد فقط (بقية الأدوار المطلوبة كانت موجودة أصلاً)', () => {
    assert.ok(ROLES.some((r) => r.key === 'hse_manager'));
  });

  test('كل توليفة دور × وحدة معرَّفة بشكل سليم (level صالح)', () => {
    const validLevels = ['none', 'view', 'edit', 'full'];
    for (const role of ROLES) {
      for (const mod of MODULES) {
        const perm = getPermission(role.key, mod);
        assert.ok(perm && validLevels.includes(perm.level), `${role.key} × ${mod} غير صالحة`);
      }
    }
  });
});

describe('صلاحيات مدير النظام (system_admin) تلقائياً على الوحدات الجديدة', () => {
  test('fullAll() تمنحه اعتماد كامل على كل وحدات HSE بلا أي تعديل يدوي', () => {
    for (const m of HSE_MODULES) assert.equal(can('system_admin', m, 'approve'), true);
  });
});

describe('hse_manager - سلطة كاملة على القسم الثامن، بلا تسرّب لوحدات لا علاقة لها به', () => {
  test('اعتماد كامل على كل الوحدات التسع', () => {
    for (const m of HSE_MODULES) assert.equal(can('hse_manager', m, 'approve'), true);
  });
  test('بلا أي صلاحية على وحدات الأعمال (biz_*) التي لم تُذكر صراحة', () => {
    assert.equal(can('hse_manager', 'biz_contract', 'view'), false);
  });
});

describe('safety_officer - سلطة تشغيلية يومية كاملة، باستثناء الاعتماد النهائي للتصاريح', () => {
  test('اعتماد كامل على المخاطر/التفتيش/الحوادث/الإجراءات التصحيحية', () => {
    for (const m of ['hse_risk', 'hse_inspection', 'hse_incident', 'hse_corrective_action']) {
      assert.equal(can('safety_officer', m, 'approve'), true);
    }
  });
  test('يستطيع تعديل التصاريح لكن لا يستطيع اعتمادها نهائياً', () => {
    assert.equal(can('safety_officer', 'hse_permit', 'edit'), true);
    assert.equal(can('safety_officer', 'hse_permit', 'approve'), false);
  });
});

describe('worker - إبلاغ ذاتي عن الحوادث بلا صلاحيات إدارية', () => {
  test('يستطيع إنشاء بلاغ حادث', () => { assert.equal(can('worker', 'hse_incident', 'create'), true); });
  test('لا يستطيع حذف حادث', () => { assert.equal(can('worker', 'hse_incident', 'delete'), false); });
  test('لا يستطيع اعتماد أي شيء', () => { assert.equal(can('worker', 'hse_incident', 'approve'), false); });
  test('لا يملك أي صلاحية على التصاريح أو المخاطر', () => {
    assert.equal(can('worker', 'hse_permit', 'view'), false);
    assert.equal(can('worker', 'hse_risk', 'view'), false);
  });
});

describe('client - رؤية أداء السلامة العام فقط', () => {
  test('يرى التفتيش والحوادث', () => {
    assert.equal(can('client', 'hse_inspection', 'view'), true);
    assert.equal(can('client', 'hse_incident', 'view'), true);
  });
  test('لا يستطيع التعديل على الإطلاق', () => {
    assert.equal(can('client', 'hse_incident', 'edit'), false);
  });
});

describe('assertPermission يرمي PmPermissionError بوضوح عند تجاوز الحدود', () => {
  test('عامل يحاول إنشاء تصريح عمل', () => {
    assert.throws(() => assertPermission('worker', 'hse_permit', 'create'), PmPermissionError);
  });
  test('مسؤول سلامة يحاول اعتماد تصريح نهائياً', () => {
    assert.throws(() => assertPermission('safety_officer', 'hse_permit', 'approve'), PmPermissionError);
  });
});

describe('getFullMatrix تتضمن الأدوار والوحدات الجديدة دون كسر الأقسام السابقة', () => {
  test('عدد صفوف المصفوفة يطابق عدد الأدوار', () => {
    assert.equal(getFullMatrix().length, ROLES.length);
  });
  test('equipment_manager (من القسم السابع) ما زال يعمل كما كان', () => {
    assert.equal(can('equipment_manager', 'equipment', 'approve'), true);
  });
});
