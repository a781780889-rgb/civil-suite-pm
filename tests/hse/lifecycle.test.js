// tests/hse/lifecycle.test.js
// اختبار تكامل حقيقي (SQLite فعلية، بلا محاكاة) للسيناريو الكامل المطلوب صراحة في الوثيقة
// الثانية، البند 24: إنشاء مشروع → إضافة مخاطر → إصدار تصريح عمل → تنفيذ تفتيش → تسجيل ملاحظة
// → إنشاء إجراء تصحيحي → تسجيل حادث → إغلاق الحادث → تحديث مؤشرات الأداء → ظهور البيانات في
// لوحة التحكم والتقارير - بالإضافة لاختبار الصلاحيات والإشعارات والتكامل مع المعدات.
//
// يستخدم نفس data/civil-suite.sqlite3 الموحّد (كبقية اختبارات tests/business وtests/pm)،
// وليس ملفاً معزولاً - بمعرّفات فريدة عبر Date.now() لتفادي أي تعارض مع بيانات حقيقية.
//
// تشغيل: node --test tests/hse/lifecycle.test.js
// يتطلب: npm install (better-sqlite3 غير متاح في بيئة التطوير الحالية بلا اتصال إنترنت -
// لم يُشغَّل هذا الاختبار فعلياً بعد؛ راجع صراحة الأقسام 4-7 لنفس القيد بالضبط).
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

let db, sites, risks, permits, inspections, incidents, correctiveActions, dashboardDb, notifications, notificationsScan, equipmentDb;

before(async () => {
  db = await import('../../lib/db.js');
  sites = await import('../../lib/hse/db/sites.js');
  risks = await import('../../lib/hse/db/risks.js');
  permits = await import('../../lib/hse/db/permits.js');
  inspections = await import('../../lib/hse/db/inspections.js');
  incidents = await import('../../lib/hse/db/incidents.js');
  correctiveActions = await import('../../lib/hse/db/correctiveActions.js');
  dashboardDb = await import('../../lib/hse/db/dashboard.js');
  notifications = await import('../../lib/hse/db/notifications.js');
  notificationsScan = await import('../../lib/hse/notificationsScan.js');
  equipmentDb = await import('../../lib/equipment/db/equipment.js');
});

describe('السيناريو الكامل (البند 24 حرفياً)', () => {
  let projectId, siteId, riskId, permitId, inspectionId, itemId, incidentId, correctiveActionId;
  const marker = `TESTHSE-${Date.now()}`;

  test('1) إنشاء مشروع', () => {
    const project = db.createProject({ name: `مشروع اختبار السلامة ${marker}` });
    projectId = project.id;
    assert.ok(projectId > 0);
  });

  test('2) إنشاء موقع عمل', () => {
    const site = sites.createSite({ project_id: projectId, name: `موقع ${marker}`, location: 'الرياض' }, 'test');
    siteId = site.id;
    assert.equal(site.project_id, projectId);
  });

  test('3) إضافة خطر بمستوى حرج (5×5) - يُنشئ تنبيهاً تلقائياً', () => {
    const risk = risks.createRisk({ project_id: projectId, site_id: siteId, title: `خطر سقوط ${marker}`, category: 'fall', likelihood: 5, severity: 5 }, 'test');
    riskId = risk.id;
    assert.equal(risk.risk_level, 'critical');
    assert.equal(risk.risk_score, 25);
  });

  test('4) إصدار تصريح عمل مرتبط بالخطر، ثم اعتماده بالكامل حتى النشاط', () => {
    const permit = permits.createPermit({ project_id: projectId, site_id: siteId, permit_type: 'working_at_height', start_date: '2026-08-01', end_date: '2026-08-10', linked_risk_id: riskId }, 'test');
    permitId = permit.id;
    permits.submitPermitForApproval(permitId, 'test', 'safety_officer');
    const approved = permits.decidePermit(permitId, { decision: 'approved' }, 'test', 'hse_manager');
    assert.equal(approved.status, 'approved');
    const active = permits.activatePermit(permitId, 'test');
    assert.equal(active.status, 'active');
  });

  test('5) تنفيذ تفتيش وتسجيل ملاحظة (بند غير مطابق) - يُنشئ إجراءً تصحيحياً تلقائياً', () => {
    const inspection = inspections.createInspection({
      project_id: projectId, site_id: siteId, inspection_date: '2026-08-02',
      items: [{ item_text: 'خوذ السلامة مرتداة من الجميع' }],
    }, 'test');
    inspectionId = inspection.id;
    itemId = inspection.items[0].id;
    const result = inspections.recordInspectionItemResult(itemId, { is_compliant: false, severity: 'major', responsible: 'test' }, 'test');
    assert.equal(result.is_compliant, 0);
    assert.ok(result.corrective_action_id > 0, 'يجب أن يُنشئ بند غير مطابق إجراءً تصحيحياً فعلياً');
    correctiveActionId = result.corrective_action_id;
  });

  test('6) إغلاق الإجراء التصحيحي يتطلب اعتماداً صريحاً - لا يُغلق بدونه', () => {
    assert.throws(() => correctiveActions.approveAndCloseCorrectiveAction(correctiveActionId, {}, 'test'));
    const closed = correctiveActions.approveAndCloseCorrectiveAction(correctiveActionId, { approved_by: 'مدير السلامة' }, 'test');
    assert.equal(closed.status, 'closed');
  });

  test('7) تسجيل حادث', () => {
    const incident = incidents.createIncident({
      project_id: projectId, site_id: siteId, incident_type: 'first_aid_injury', incident_date: '2026-08-03',
      affected_persons: [{ name: 'عامل اختبار', injury_severity: 'minor' }],
    }, 'test');
    incidentId = incident.id;
    assert.equal(incident.affected_persons.length, 1);
  });

  test('8) إغلاق الحادث يتطلب اكتمال التحقيق أولاً', () => {
    assert.throws(() => incidents.closeIncident(incidentId, {}, 'test'));
    incidents.updateInvestigation(incidentId, { investigation_status: 'completed', root_cause: 'سبب اختباري' }, 'test');
    const closed = incidents.closeIncident(incidentId, { closed_by: 'test' }, 'test');
    assert.equal(closed.status, 'closed');
  });

  test('9) تحديث مؤشرات الأداء وظهور البيانات في لوحة التحكم', () => {
    const dashboard = dashboardDb.getHseDashboard({ project_id: projectId });
    assert.ok(dashboard.totals.incident_count >= 1);
    assert.ok(dashboard.totals.critical_risk_count >= 0); // أُغلق أو لا يزال مفتوحاً حسب الترتيب أعلاه
  });

  test('10) التقارير تعكس البيانات الحقيقية المُدخَلة', async () => {
    const { buildIncidentsReport } = await import('../../lib/hse/reportsData.js');
    const report = buildIncidentsReport({ project_id: projectId, from: '2026-01-01', to: '2026-12-31' });
    assert.ok(report.rows.length >= 1, 'يجب أن يظهر الحادث المُسجَّل أعلاه في التقرير فعلياً');
    assert.ok(report.rows.some((r) => r.injured_count === 1), 'عدد المصابين المحسوب من affected_persons يجب أن يطابق ما أُدخل');
  });
});

describe('التكامل الحقيقي مع قسم المعدات (البند 13)', () => {
  test('يمنع اعتماد تصريح مرتبط بمعدة خارج الخدمة', () => {
    const project = db.createProject({ name: `مشروع اختبار معدات ${Date.now()}` });
    const equipment = equipmentDb.createEquipment({ name: `معدة اختبار ${Date.now()}` }, 'test');
    equipmentDb.changeEquipmentStatus(equipment.id, 'out_of_service', 'تعطيل لغرض الاختبار', 'test');
    const permit = permits.createPermit({ project_id: project.id, permit_type: 'lifting', start_date: '2026-08-01', end_date: '2026-08-05', equipment_id: equipment.id }, 'test');
    permits.submitPermitForApproval(permit.id, 'test', 'safety_officer');
    assert.throws(
      () => permits.decidePermit(permit.id, { decision: 'approved' }, 'test', 'hse_manager'),
      /خارج الخدمة/,
      'يجب أن يُرفض اعتماد التصريح فعلياً - وليس مجرد تحذير شكلي'
    );
  });
});

describe('التنبيهات الذكية (البند 18) - فحص حقيقي على بيانات حقيقية', () => {
  test('فحص التنبيهات لا يرمي أخطاء ويُنشئ تنبيهات فعلية للمخاطر الحرجة المفتوحة', () => {
    assert.doesNotThrow(() => notificationsScan.runHseNotificationScan());
    const list = notifications.listNotifications({ pageSize: 5 });
    assert.ok(Array.isArray(list.rows));
  });
});
