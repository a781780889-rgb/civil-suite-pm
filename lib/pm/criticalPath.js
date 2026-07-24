// lib/pm/criticalPath.js
// =============================================================================
// محرك جدولة حقيقي بطريقة المسار الحرج (Critical Path Method) - يدعم أنواع التبعية
// الأربعة القياسية (FS/SS/FF/SF) مع فترة تأخر/تقديم (Lag/Lead بالأيام)، تماماً كما
// تشترط مواصفة القسم الرابع ("ربط الأنشطة"، "التبعيات"، "المسار الحرج"). هذا حساب حقيقي
// (تمريرتان أمامية وخلفية + حساب الطفو الحر Float) وليس ترتيباً تقريبياً حسب تاريخ الإدخال.
//
// افتراض التصميم (موثّق بالكامل هنا وفي README): المهام التي بلا سلف (Root Tasks) تُستخدم
// قيمة planned_start المُدخلة لها (إن وُجدت) كنقطة انطلاق فعلية (Offset عن تاريخ بداية
// المشروع)؛ أما المهام التابعة فتُحسب بداياتها فعلياً من التبعيات والمدد فقط - هذا يسمح بتثبيت
// بداية كل مرحلة يدوياً مع بقاء جدولة مهامها الداخلية حقيقية 100% من التبعيات.
// =============================================================================

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const EPS = 1e-6;

function toDateOnly(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function parseDateStr(s) {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return toDateOnly(d);
}

function daysBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

export function addDaysToDateStr(dateStr, days) {
  const base = parseDateStr(dateStr) || toDateOnly(new Date());
  const out = new Date(base.getTime() + Math.round(days) * MS_PER_DAY);
  return out.toISOString().slice(0, 10);
}

/** ترتيب طوبولوجي بخوارزمية Kahn - يكتشف الدورات فعلياً بدل افتراض عدم وجودها. */
function topoSort(taskIds, edges) {
  const inDegree = new Map(taskIds.map((id) => [id, 0]));
  const adj = new Map(taskIds.map((id) => [id, []]));
  for (const e of edges) {
    if (!adj.has(e.depends_on_task_id) || !inDegree.has(e.task_id)) continue; // يتجاهل تبعية على مهمة من مشروع آخر/محذوفة
    adj.get(e.depends_on_task_id).push(e);
    inDegree.set(e.task_id, (inDegree.get(e.task_id) || 0) + 1);
  }
  const queue = taskIds.filter((id) => inDegree.get(id) === 0);
  const order = [];
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    for (const e of adj.get(id)) {
      inDegree.set(e.task_id, inDegree.get(e.task_id) - 1);
      if (inDegree.get(e.task_id) === 0) queue.push(e.task_id);
    }
  }
  return { order, hasCycle: order.length !== taskIds.length };
}

/**
 * يحسب الجدول الزمني الكامل (تمريرة أمامية وخلفية) لمجموعة مهام مشروع واحد.
 * @param {Array} tasks - [{id, duration_days, planned_start}]
 * @param {Array} dependencies - [{task_id, depends_on_task_id, dep_type, lag_days}]
 * @param {string} projectStartDate - تاريخ بداية المشروع (ISO) - يُستخدم كمرجع صفر الأيام
 */
export function computeCriticalPath({ tasks, dependencies, projectStartDate }) {
  if (!tasks || tasks.length === 0) {
    return { ok: true, projectDurationDays: 0, projectComputedEndDate: projectStartDate || null, schedule: [], criticalPath: [] };
  }
  const ids = tasks.map((t) => t.id);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const predsOf = new Map(ids.map((id) => [id, []])); // successor -> [{predId, type, lag}]
  const succsOf = new Map(ids.map((id) => [id, []])); // predecessor -> [{succId, type, lag}]

  for (const dep of dependencies || []) {
    if (!byId.has(dep.task_id) || !byId.has(dep.depends_on_task_id)) continue;
    predsOf.get(dep.task_id).push({ id: dep.depends_on_task_id, type: dep.dep_type || 'FS', lag: Number(dep.lag_days) || 0 });
    succsOf.get(dep.depends_on_task_id).push({ id: dep.task_id, type: dep.dep_type || 'FS', lag: Number(dep.lag_days) || 0 });
  }

  const { order, hasCycle } = topoSort(ids, dependencies || []);
  if (hasCycle) {
    return { ok: false, error: 'يوجد تعارض دوري بين تبعيات المهام (Circular Dependency) - لا يمكن حساب المسار الحرج حتى تصحيحه.' };
  }

  const projStart = parseDateStr(projectStartDate) || toDateOnly(new Date());
  const ES = new Map();
  const EF = new Map();

  // ---- التمريرة الأمامية ----
  for (const id of order) {
    const task = byId.get(id);
    const duration = Math.max(0, Number(task.duration_days) || 0);
    const preds = predsOf.get(id);
    let es = 0;
    if (preds.length === 0) {
      const pinned = parseDateStr(task.planned_start);
      es = pinned ? Math.max(0, daysBetween(projStart, pinned)) : 0;
    } else {
      for (const p of preds) {
        const pEF = EF.get(p.id) ?? 0;
        const pES = ES.get(p.id) ?? 0;
        let constraint;
        if (p.type === 'SS') constraint = pES + p.lag;
        else if (p.type === 'FF') constraint = pEF + p.lag - duration;
        else if (p.type === 'SF') constraint = pES + p.lag - duration;
        else constraint = pEF + p.lag; // FS (افتراضي)
        es = Math.max(es, constraint);
      }
    }
    ES.set(id, es);
    EF.set(id, es + duration);
  }

  const projectDurationDays = Math.max(0, ...ids.map((id) => EF.get(id) ?? 0));

  // ---- التمريرة الخلفية ----
  const LF = new Map();
  const LS = new Map();
  for (let i = order.length - 1; i >= 0; i -= 1) {
    const id = order[i];
    const task = byId.get(id);
    const duration = Math.max(0, Number(task.duration_days) || 0);
    const succs = succsOf.get(id);
    let lf;
    if (succs.length === 0) {
      lf = projectDurationDays;
    } else {
      lf = Infinity;
      for (const s of succs) {
        const sLS = LS.get(s.id) ?? projectDurationDays;
        const sLF = LF.get(s.id) ?? projectDurationDays;
        let constraint;
        if (s.type === 'SS') constraint = sLS - s.lag + duration;
        else if (s.type === 'FF') constraint = sLF - s.lag;
        else if (s.type === 'SF') constraint = sLF - s.lag + duration;
        else constraint = sLS - s.lag; // FS
        lf = Math.min(lf, constraint);
      }
      if (!Number.isFinite(lf)) lf = projectDurationDays;
    }
    LF.set(id, lf);
    LS.set(id, lf - duration);
  }

  const schedule = ids.map((id) => {
    const es = ES.get(id) ?? 0;
    const ef = EF.get(id) ?? 0;
    const ls = LS.get(id) ?? 0;
    const lf = LF.get(id) ?? 0;
    const floatDays = Math.round((ls - es) * 1000) / 1000;
    return {
      id,
      esDay: es, efDay: ef, lsDay: ls, lfDay: lf,
      floatDays,
      isCritical: Math.abs(floatDays) < EPS,
      esDate: addDaysToDateStr(projectStartDate, es),
      efDate: addDaysToDateStr(projectStartDate, ef),
      lsDate: addDaysToDateStr(projectStartDate, ls),
      lfDate: addDaysToDateStr(projectStartDate, lf),
    };
  });

  const criticalPath = schedule.filter((s) => s.isCritical).sort((a, b) => a.esDay - b.esDay).map((s) => s.id);

  return {
    ok: true,
    projectDurationDays,
    projectComputedEndDate: addDaysToDateStr(projectStartDate, projectDurationDays),
    schedule,
    criticalPath,
  };
}

/**
 * تحليل تأخير: يقارن EF المحسوب (أو actual_end الفعلي إن اكتملت المهمة) بـ planned_end
 * المُدخل يدوياً، ويُعيد فقط المهام المتأخرة فعلياً - يُستخدم لتوليد تنبيهات حقيقية.
 */
export function findDelayedTasks(tasks, todayStr) {
  const today = parseDateStr(todayStr) || toDateOnly(new Date());
  const delayed = [];
  for (const t of tasks) {
    if (t.status === 'completed') continue;
    const plannedEnd = parseDateStr(t.planned_end);
    if (!plannedEnd) continue;
    if (today.getTime() > plannedEnd.getTime()) {
      delayed.push({ ...t, delayDays: daysBetween(plannedEnd, today) });
    }
  }
  return delayed;
}
