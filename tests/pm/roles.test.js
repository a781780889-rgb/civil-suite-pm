// tests/pm/roles.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { can, assertPermission, PmPermissionError, ROLES, MODULES } from '../../lib/pm/roles.js';

describe('مصفوفة الصلاحيات — قواعد أساسية', () => {
  test('مدير النظام يملك كل الصلاحيات على كل الوحدات', () => {
    for (const role of ['system_admin']) {
      for (const mod of MODULES) {
        assert.equal(can(role, mod, 'view'), true, `${role}/${mod}/view`);
        assert.equal(can(role, mod, 'delete'), true, `${role}/${mod}/delete`);
      }
    }
  });

  test('العامل (worker) لا يملك أي صلاحية على الميزانية', () => {
    assert.equal(can('worker', 'budget', 'view'), false);
    assert.equal(can('worker', 'budget', 'edit'), false);
  });

  test('العميل لا يرى الميزانية إطلاقاً', () => {
    assert.equal(can('client', 'budget', 'view'), false);
  });

  test('العميل يستطيع اعتماد المراحل (تسليمات) لكن لا يعدّلها', () => {
    assert.equal(can('client', 'phase', 'approve'), true);
    assert.equal(can('client', 'phase', 'edit'), false);
  });

  test('المحاسب يملك كل صلاحيات الميزانية بما فيها الاعتماد', () => {
    assert.equal(can('accountant', 'budget', 'approve'), true);
    assert.equal(can('accountant', 'budget', 'delete'), true);
  });

  test('مسؤول الجودة له صلاحية كاملة على الجودة فقط، لا على السلامة', () => {
    assert.equal(can('quality_officer', 'quality', 'delete'), true);
    assert.equal(can('safety_officer', 'quality', 'edit'), false);
  });

  test('كل الأدوار الخمسة عشر معرّفة في المصفوفة (لا دور بلا صلاحيات معرّفة)', () => {
    for (const r of ROLES) {
      assert.notEqual(can(r.key, 'project', 'view'), undefined);
    }
    assert.equal(ROLES.length, 15); // 14 أصلية + planning_engineer (مهندس التخطيط) أُضيف مع القسم الخامس
  });

  test('دور غير معروف لا يملك أي صلاحية (fail-safe افتراضي)', () => {
    assert.equal(can('unknown_role', 'project', 'view'), false);
  });
});

describe('assertPermission', () => {
  test('يرمي PmPermissionError عند غياب الصلاحية', () => {
    assert.throws(() => assertPermission('worker', 'budget', 'edit'), PmPermissionError);
  });
  test('لا يرمي عند توفر الصلاحية', () => {
    assert.doesNotThrow(() => assertPermission('system_admin', 'budget', 'edit'));
  });
});
