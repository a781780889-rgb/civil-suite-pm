// tests/boq/db.test.js
// اختبارات تكامل حقيقية على طبقة قاعدة البيانات (SQLite فعلية، بلا أي محاكاة/mock).
// تشغيل: node --test tests/boq/db.test.js
// ملاحظة: يُنشئ هذا الاختبار قاعدة بيانات فعلية في data/civil-suite.sqlite3 ضمن نسخة العمل
// (نفس ملف قاعدة البيانات الذي يستخدمه التطبيق في وضع التطوير) - وهذا متعمّد لاختبار
// initSchema/الفهارس/القيود الفعلية بلا تبسيط، وليس ملفاً يُشحن مع التسليم النهائي.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

let db;

before(async () => {
  db = await import('../../lib/db.js');
});

describe('البنية الأساسية وزراعة الأصناف', () => {
  test('boq_categories تُزرع تلقائياً بعدد يطابق سجل الأصناف بالضبط', async () => {
    const { CATEGORIES } = await import('../../lib/boq/categoryRegistry.js');
    const cats = db.listBoqCategories();
    assert.equal(cats.length, CATEGORIES.length);
  });

  test('كل صنف مزروع يحمل حقول fields مفكوكة من JSON بشكل صحيح', () => {
    const cat = db.getBoqCategory('concrete_isolated_footing');
    assert.ok(Array.isArray(cat.fields));
    assert.ok(cat.fields.length > 0);
  });
});

describe('دورة حياة عنصر حصر كميات كاملة', () => {
  let projectId;
  let elementId;

  test('إنشاء مشروع للاختبار', () => {
    const project = db.createProject({ name: 'مشروع اختبار حصر الكميات' });
    projectId = project.id;
    assert.ok(projectId > 0);
  });

  test('إنشاء عنصر حصر كميات (قواعد منفصلة) وحفظه فعلياً', () => {
    const el = db.createBoqElement({
      project_id: projectId,
      category_key: 'concrete_isolated_footing',
      name: 'قواعد المحور A1-A5',
      location_note: 'الدور الأرضي',
      dimensions: { lengthM: 2, widthM: 2, heightM: 0.5, count: 5 },
      quantity: 2, unit: 'm3', waste_pct: 5, quantity_with_waste: 10.5,
      unit_material_price: 350, total_cost: 3675,
      source: 'manual',
    });
    elementId = el.id;
    assert.ok(el.uuid, 'يجب أن يُولَّد UUID فريد تلقائياً');
    assert.equal(el.quantity_with_waste, 10.5);
    assert.equal(el.dimensions.count, 5);
  });

  test('سجل التدقيق يحتوي سطر "create" فور الإنشاء', () => {
    const audit = db.listBoqAuditLog({ element_id: elementId });
    assert.equal(audit.length, 1);
    assert.equal(audit[0].action, 'create');
    assert.equal(audit[0].before, null);
    assert.ok(audit[0].after.name.includes('قواعد المحور'));
  });

  test('اكتشاف التكرار: نفس الاسم والصنف والموقع داخل نفس المشروع', () => {
    const dup = db.findDuplicateBoqElement({ project_id: projectId, category_key: 'concrete_isolated_footing', name: 'قواعد المحور A1-A5', location_note: 'الدور الأرضي' });
    assert.ok(dup);
    assert.equal(dup.id, elementId);
  });

  test('لا يوجد تكرار لعنصر مختلف الموقع', () => {
    const dup = db.findDuplicateBoqElement({ project_id: projectId, category_key: 'concrete_isolated_footing', name: 'قواعد المحور A1-A5', location_note: 'الدور الأول' });
    assert.equal(dup, null);
  });

  test('تحديث عنصر يغيّر القيم ويُسجَّل قبل/بعد في سجل التدقيق', () => {
    const updated = db.updateBoqElement(elementId, { name: 'قواعد المحور A1-A5 (مُعدَّل)', total_cost: 4000 });
    assert.equal(updated.name, 'قواعد المحور A1-A5 (مُعدَّل)');
    assert.equal(updated.total_cost, 4000);
    const audit = db.listBoqAuditLog({ element_id: elementId });
    const updateEntry = audit.find((a) => a.action === 'update');
    assert.ok(updateEntry);
    assert.equal(updateEntry.before.total_cost, 3675);
    assert.equal(updateEntry.after.total_cost, 4000);
  });

  test('حذف عنصر يزيله من القائمة لكن يبقيه في سجل التدقيق كاملاً', () => {
    const result = db.deleteBoqElement(elementId, 'tester');
    assert.equal(result.deleted, true);
    assert.equal(db.getBoqElement(elementId), null);
    const audit = db.listBoqAuditLog({ element_id: elementId });
    const deleteEntry = audit.find((a) => a.action === 'delete');
    assert.ok(deleteEntry.before.name.includes('مُعدَّل'));
    assert.equal(deleteEntry.after, null);
  });
});

describe('الإدراج الجماعي (استيراد) واكتشاف التكرار الجماعي', () => {
  let projectId;
  before(() => {
    projectId = db.createProject({ name: 'مشروع اختبار الاستيراد' }).id;
  });

  test('يُدرج الصفوف الصالحة ويتجاهل التكرارات داخل نفس الدفعة', () => {
    const rows = [
      { category_key: 'masonry_block', name: 'جدار خارجي شمالي', unit: 'm2', quantity: 40, quantity_with_waste: 42, total_cost: 1000 },
      { category_key: 'masonry_block', name: 'جدار خارجي جنوبي', unit: 'm2', quantity: 35, quantity_with_waste: 37, total_cost: 900 },
      // تكرار متعمّد لأول صف بنفس الاسم والصنف (بلا موقع في الحالتين)
      { category_key: 'masonry_block', name: 'جدار خارجي شمالي', unit: 'm2', quantity: 40, quantity_with_waste: 42, total_cost: 1000 },
    ];
    const result = db.bulkInsertBoqElements(projectId, rows, { source: 'import', sourceRef: 'test.csv' });
    assert.equal(result.inserted.length, 2);
    assert.equal(result.skipped.length, 1);
    assert.match(result.skipped[0].reason, /مكرر/);
  });

  test('سجل الاستيراد يُحفظ ويمكن استرجاعه', () => {
    const log = db.createBoqImportLog({ project_id: projectId, file_name: 'test.csv', file_type: 'csv', total_rows: 3, imported_count: 2, rejected_count: 1, rejected: [{ row: 3, reason: 'مكرر' }] });
    assert.ok(log.id > 0);
    const list = db.listBoqImports(projectId);
    assert.equal(list.length, 1);
    assert.equal(list[0].rejected[0].reason, 'مكرر');
  });
});

describe('مكتبة الأسعار', () => {
  test('إنشاء بند سعر ثم تحديثه ثم حذفه', () => {
    const created = db.upsertBoqPriceItem({ item_name: 'إسمنت بورتلاندي', unit: 'kg', material_price: 0.45 });
    assert.ok(created.id > 0);
    const updated = db.upsertBoqPriceItem({ id: created.id, item_name: 'إسمنت بورتلاندي', unit: 'kg', material_price: 0.5 });
    assert.equal(updated.material_price, 0.5);
    db.deleteBoqPriceItem(created.id);
    assert.equal(db.getBoqPriceItem(created.id), undefined);
  });
});

describe('لوحة تحكم حصر الكميات', () => {
  test('تجمع التكاليف والكميات حسب التخصص بشكل صحيح', () => {
    const projectId = db.createProject({ name: 'مشروع لوحة التحكم' }).id;
    db.createBoqElement({ project_id: projectId, category_key: 'concrete_isolated_footing', name: 'ق1', unit: 'm3', quantity: 2, quantity_with_waste: 2.1, total_cost: 500 });
    db.createBoqElement({ project_id: projectId, category_key: 'masonry_block', name: 'جدار1', unit: 'm2', quantity: 20, quantity_with_waste: 21, total_cost: 300 });
    const stats = db.getBoqDashboardStats(projectId);
    assert.equal(stats.totalElements, 2);
    assert.equal(stats.totalCost, 800);
    const concreteTrade = stats.byTrade.find((t) => t.trade === 'concrete');
    const masonryTrade = stats.byTrade.find((t) => t.trade === 'masonry');
    assert.equal(concreteTrade.cost, 500);
    assert.equal(masonryTrade.cost, 300);
  });
});

describe('الترقيم الصفحي (Pagination)', () => {
  test('total و totalPages صحيحان مع تصفية حسب المشروع', () => {
    const projectId = db.createProject({ name: 'مشروع الترقيم الصفحي' }).id;
    for (let i = 0; i < 23; i += 1) {
      db.createBoqElement({ project_id: projectId, category_key: 'electrical_lighting', name: `نقطة إنارة ${i}`, unit: 'ea', quantity: 1, quantity_with_waste: 1, total_cost: 50 });
    }
    const page1 = db.listBoqElements({ project_id: projectId, page: 1, pageSize: 10 });
    assert.equal(page1.total, 23);
    assert.equal(page1.rows.length, 10);
    assert.equal(page1.totalPages, 3);
    const page3 = db.listBoqElements({ project_id: projectId, page: 3, pageSize: 10 });
    assert.equal(page3.rows.length, 3);
  });
});

describe('فحص أداء مبدئي (وليس اختباراً كاملاً للحمل الإنتاجي)', () => {
  test('استعلام صفحة واحدة من بين آلاف العناصر يبقى سريعاً بفضل الفهارس', () => {
    const projectId = db.createProject({ name: 'مشروع فحص الأداء' }).id;
    const N = 3000;
    const t0 = Date.now();
    for (let i = 0; i < N; i += 1) {
      db.createBoqElement({ project_id: projectId, category_key: 'electrical_switches', name: `مفتاح ${i}`, unit: 'ea', quantity: 1, quantity_with_waste: 1, total_cost: 10 });
    }
    const insertMs = Date.now() - t0;

    const t1 = Date.now();
    const page = db.listBoqElements({ project_id: projectId, page: 50, pageSize: 50 });
    const queryMs = Date.now() - t1;

    assert.equal(page.total, N);
    assert.equal(page.rows.length, 50);
    // هذا سقف سخي متعمَّد (وليس رقم أداء مضمون على كل عتاد) - الهدف اكتشاف انحدار خوارزمي
    // فادح (O(n) بدل استخدام الفهرس) لا قياس أداء دقيق لبيئة إنتاج فعلية.
    assert.ok(queryMs < 1000, `استعلام الصفحة استغرق ${queryMs}ms - أبطأ من المتوقع مع وجود فهرس`);
    console.log(`    [معلومة] إدراج ${N} عنصر: ${insertMs}ms — استعلام صفحة واحدة منها: ${queryMs}ms`);
  });
});
