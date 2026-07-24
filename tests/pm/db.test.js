// tests/pm/db.test.js
// اختبارات تكامل حقيقية على طبقة قاعدة بيانات القسم الرابع (SQLite فعلية، بلا أي محاكاة/mock).
// تشغيل: node --test tests/pm/db.test.js
// ملاحظة: يستخدم نفس data/civil-suite.sqlite3 الذي يستخدمه db.test.js الخاص بالقسم الثالث
// (نفس القاعدة الموحّدة) - متعمّد، وليس ملفاً يُشحن مع التسليم النهائي.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

let projects, phases, tasks, team, budget, resources, risks, quality, safety, documents, meetings, notifications, projectStats, audit, cpm;

before(async () => {
  projects = await import('../../lib/pm/db/projects.js');
  phases = await import('../../lib/pm/db/phases.js');
  tasks = await import('../../lib/pm/db/tasks.js');
  team = await import('../../lib/pm/db/team.js');
  budget = await import('../../lib/pm/db/budget.js');
  resources = await import('../../lib/pm/db/resources.js');
  risks = await import('../../lib/pm/db/risks.js');
  quality = await import('../../lib/pm/db/quality.js');
  safety = await import('../../lib/pm/db/safety.js');
  documents = await import('../../lib/pm/db/documents.js');
  meetings = await import('../../lib/pm/db/meetings.js');
  notifications = await import('../../lib/pm/db/notifications.js');
  projectStats = await import('../../lib/pm/db/projectStats.js');
  audit = await import('../../lib/pm/db/audit.js');
  cpm = await import('../../lib/pm/criticalPath.js');
});

describe('دورة حياة مشروع كاملة', () => {
  let projectId, phaseId, t1Id, t2Id, memberId, resourceId, docId, meetingId;

  test('إنشاء مشروع برقم فريد', () => {
    const p = projects.createProjectFull({ name: 'مشروع اختبار PM', project_code: `TEST-${Date.now()}`, budget: 100000, contract_value: 130000, status: 'in_progress', start_date: '2026-01-01', actor: 'test' });
    projectId = p.id;
    assert.ok(projectId > 0);
    assert.equal(p.status, 'in_progress');
  });

  test('منع رقم مشروع مكرر', () => {
    const code = `DUP-${Date.now()}`;
    projects.createProjectFull({ name: 'أ', project_code: code, actor: 'test' });
    assert.ok(projects.findDuplicateProjectCode(code));
  });

  test('تغيير حالة المشروع يُسجَّل في السجل التاريخي', () => {
    projects.changeProjectStatus(projectId, 'stopped', { note: 'اختبار', actor: 'test' });
    const history = projects.listProjectStatusHistory(projectId);
    assert.ok(history.some((h) => h.new_status === 'stopped'));
    projects.changeProjectStatus(projectId, 'in_progress', { actor: 'test' });
  });

  test('إنشاء مرحلة', () => {
    const ph = phases.createPhase({ project_id: projectId, name: 'التنفيذ', actor: 'test' });
    phaseId = ph.id;
    assert.ok(phaseId > 0);
  });

  test('إنشاء مهمتين مرتبطتين بتبعية وحساب المسار الحرج', () => {
    const t1 = tasks.createTask({ project_id: projectId, phase_id: phaseId, title: 'حفر', duration_days: 5, status: 'completed', progress_pct: 100, actor: 'test' });
    const t2 = tasks.createTask({ project_id: projectId, phase_id: phaseId, title: 'خرسانة', duration_days: 3, progress_pct: 50, actor: 'test' });
    t1Id = t1.id; t2Id = t2.id;
    tasks.addDependency({ task_id: t2Id, depends_on_task_id: t1Id, dep_type: 'FS' }, 'test');

    const allTasks = tasks.listTasks({ project_id: projectId });
    const deps = tasks.listAllDependenciesForProject(projectId);
    const schedule = cpm.computeCriticalPath({ tasks: allTasks, dependencies: deps, projectStartDate: '2026-01-01' });
    assert.equal(schedule.ok, true);
    assert.equal(schedule.projectDurationDays, 8);
  });

  test('نسبة إنجاز المرحلة تُحدَّث تلقائياً من مهامها', () => {
    const ph = phases.getPhase(phaseId);
    // t1: 5 أيام@100% + t2: 3 أيام@50% => (5*100+3*50)/8 = 81.25
    assert.equal(ph.progress_pct, 81.25);
  });

  test('منع اعتماد مهمة على نفسها', () => {
    assert.throws(() => tasks.addDependency({ task_id: t1Id, depends_on_task_id: t1Id }, 'test'));
  });

  test('إضافة عضو فريق وربطه كمسؤول عن مهمة', () => {
    const m = team.createTeamMember({ project_id: projectId, name: 'مهندس اختبار', role: 'engineer', actor: 'test' });
    memberId = m.id;
    tasks.updateTask(t2Id, { assignee_id: memberId, actor: 'test' });
    assert.equal(tasks.getTask(t2Id).assignee_id, memberId);
  });

  test('بنود الميزانية وملخصها المالي', () => {
    budget.createBudgetItem({ project_id: projectId, item_type: 'expense', amount: 40000, date: '2026-01-10', actor: 'test' });
    budget.createBudgetItem({ project_id: projectId, item_type: 'revenue', amount: 20000, date: '2026-01-15', actor: 'test' });
    const summary = budget.getBudgetSummaryForProject(projectId);
    assert.equal(summary.totalExpenses, 40000);
    assert.equal(summary.profitLoss, -20000);
  });

  test('مورد وتعيينه على المشروع', () => {
    const r = resources.createResource({ resource_type: 'equipment', name: 'خلاطة اختبار' });
    resourceId = r.id;
    resources.createAssignment({ resource_id: resourceId, project_id: projectId, start_date: '2026-01-01', end_date: '2026-01-10', cost: 5000, actor: 'test' });
    const assignments = resources.listAssignments({ project_id: projectId });
    assert.ok(assignments.some((a) => a.resource_id === resourceId));
  });

  test('خطر عالي الخطورة يولّد تنبيهاً حقيقياً', () => {
    risks.createRisk({ project_id: projectId, title: 'خطر اختبار', probability: 5, impact: 5, actor: 'test' });
    const notifs = notifications.listNotifications({ project_id: projectId });
    assert.ok(notifs.some((n) => n.type === 'high_risk'));
  });

  test('رفض جودة يولّد تنبيهاً', () => {
    quality.createQualityRecord({ project_id: projectId, record_type: 'rejection', title: 'رفض اختبار', actor: 'test' });
    const notifs = notifications.listNotifications({ project_id: projectId });
    assert.ok(notifs.some((n) => n.type === 'quality_issue'));
  });

  test('حادث سلامة يولّد تنبيهاً', () => {
    safety.createSafetyRecord({ project_id: projectId, record_type: 'incident', title: 'حادث اختبار', severity: 'high', actor: 'test' });
    const notifs = notifications.listNotifications({ project_id: projectId });
    assert.ok(notifs.some((n) => n.type === 'safety_violation'));
  });

  test('إنشاء مستند وإصدار ثانٍ له مع سجل نسخ كامل', () => {
    const doc = documents.createDocument({ project_id: projectId, name: 'مخطط.pdf', file_path: `${projectId}/a.pdf`, file_size: 100, actor: 'test' });
    docId = doc.id;
    documents.addDocumentVersion(docId, { file_path: `${projectId}/b.pdf`, file_size: 200, actor: 'test' });
    assert.equal(documents.listDocumentVersions(docId).length, 2);
    assert.equal(documents.getDocument(docId).version, 2);
  });

  test('اعتماد مستند يُحدّث حالته ومعتمِده', () => {
    documents.setDocumentApproval(docId, { approved: true, approved_by: 'مدير المشروع', actor: 'test' });
    assert.equal(documents.getDocument(docId).status, 'approved');
  });

  test('اجتماع وقرار يُنشئ مهمة فعلية مرتبطة', () => {
    const mt = meetings.createMeeting({ project_id: projectId, title: 'اجتماع اختبار', actor: 'test' });
    meetingId = mt.id;
    const dec = meetings.addDecision({ meeting_id: meetingId, decision_text: 'إجراء اختبار', generateTask: true, project_id: projectId, actor: 'test' });
    assert.ok(dec.generated_task_id);
    assert.ok(tasks.getTask(dec.generated_task_id));
  });

  test('مُجمِّع إحصاءات المشروع يعمل ويعكس كل الوحدات', () => {
    const stats = projectStats.getProjectStats(projectId);
    assert.equal(stats.project.id, projectId);
    assert.ok(stats.tasksTotal >= 2);
    assert.ok(stats.openRisksCount >= 1);
    assert.equal(typeof stats.budgetSummary.spentPct, 'number');
  });

  test('سجل التدقيق يحتوي فعلياً على عمليات الإنشاء السابقة', () => {
    const log = audit.listPmAuditLog({ project_id: projectId, entity_type: 'task' });
    assert.ok(log.length >= 2);
  });

  test('حذف مهمة يحذف تبعياتها تلقائياً (CASCADE)', () => {
    tasks.deleteTask(t2Id, 'test');
    assert.equal(tasks.listAllDependenciesForProject(projectId).length, 0);
  });

  test('أرشفة المشروع بدل الحذف النهائي (Soft Delete)', () => {
    const archived = projects.setProjectArchived(projectId, true, 'test');
    assert.equal(archived.is_archived, 1);
    const { rows } = projects.listProjectsPaged({ is_archived: false });
    assert.ok(!rows.some((p) => p.id === projectId));
  });
});
