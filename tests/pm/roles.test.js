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

  test('كل الأدوار الثمانية عشر معرّفة في المصفوفة (لا دور بلا صلاحيات معرّفة)', () => {
    for (const r of ROLES) {
      assert.notEqual(can(r.key, 'project', 'view'), undefined);
    }
    // 14 أصلية + planning_engineer (القسم الخامس) + business_manager/contracts_officer/procurement_officer (القسم السادس)
    assert.equal(ROLES.length, 18);
  });

  test('دور غير معروف لا يملك أي صلاحية (fail-safe افتراضي)', () => {
    assert.equal(can('unknown_role', 'project', 'view'), false);
  });
});

describe('القسم السادس: نظام إدارة الأعمال — صلاحيات الوحدات التجارية', () => {
  test('مدير الأعمال يملك صلاحية كاملة واعتماد على كل الوحدات التجارية', () => {
    for (const mod of ['biz_client', 'biz_opportunity', 'biz_quote', 'biz_contract', 'biz_partner', 'biz_work_order', 'biz_payment', 'biz_correspondence', 'biz_meeting', 'biz_commitment']) {
      assert.equal(can('business_manager', mod, 'delete'), true, mod);
      assert.equal(can('business_manager', mod, 'approve'), true, mod);
    }
  });

  test('مسؤول العقود يعتمد العقود والمستخلصات لكن لا يدير الشركاء (المقاولين/الموردين)', () => {
    assert.equal(can('contracts_officer', 'biz_contract', 'approve'), true);
    assert.equal(can('contracts_officer', 'biz_payment', 'approve'), true);
    assert.equal(can('contracts_officer', 'biz_partner', 'delete'), false);
  });

  test('مسؤول المشتريات يدير المقاولين والموردين لكن لا يرى العملاء أو الفرص', () => {
    assert.equal(can('procurement_officer', 'biz_partner', 'delete'), true);
    assert.equal(can('procurement_officer', 'biz_client', 'view'), false);
    assert.equal(can('procurement_officer', 'biz_opportunity', 'view'), false);
  });

  test('العامل والفني لا صلاحية لهما على أي وحدة تجارية', () => {
    for (const role of ['worker', 'technician']) {
      for (const mod of ['biz_client', 'biz_quote', 'biz_contract', 'biz_payment']) {
        assert.equal(can(role, mod, 'view'), false, `${role}/${mod}`);
      }
    }
  });

  test('العميل يرى عقده وعروض أسعاره ومستخلصاته لكن لا يرى الفرص التجارية الداخلية ولا الشركاء', () => {
    assert.equal(can('client', 'biz_quote', 'view'), true);
    assert.equal(can('client', 'biz_contract', 'view'), true);
    assert.equal(can('client', 'biz_payment', 'view'), true);
    assert.equal(can('client', 'biz_opportunity', 'view'), false);
    assert.equal(can('client', 'biz_partner', 'view'), false);
  });

  test('المحاسب يعتمد الدفعات ماليّاً لكن لا يعدّل الفرص التجارية', () => {
    assert.equal(can('accountant', 'biz_payment', 'approve'), true);
    assert.equal(can('accountant', 'biz_opportunity', 'edit'), false);
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
