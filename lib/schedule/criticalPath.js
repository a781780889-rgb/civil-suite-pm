// lib/schedule/criticalPath.js
// =============================================================================
// محرك المسار الحرج (Critical Path Method) - القاعدة السادسة الإلزامية: حساب تلقائي
// حقيقي لـ ES/EF/LS/LF وTotal Float وFree Float والمسار الحرج، واعٍ بالتقويم (أيام عمل
// فعلية لا أيام تقويمية خام) عبر lib/schedule/calendar.js، بدعم كامل لأنواع العلاقات
// الأربعة (FS/SS/FF/SF) مع Lag/Lead، وكشف العلاقات الدائرية (القاعدة الخامسة)، وتلخيص
// عقد WBS الأب (activity_type='summary') من أبنائها بعد التمريرتين.
//
// البنية الحسابية (ترتيب طوبولوجي ثم تمريرة أمامية/خلفية في "مساحة إزاحة" أيام عمل مجرّدة،
// والتحويل لتواريخ حقيقية فقط في المخرجات النهائية) مطابقة عمداً لمحرك القسم الرابع المُختبر
// (lib/pm/criticalPath.js) لتقليل مخاطر أخطاء خوارزمية جديدة - الإضافة الحقيقية هنا هي وعي
// التقويم بأيام العمل، وFree Float إلى جانب Total Float، وتلخيص عقد WBS الأب.
//
// ملاحظة نطاق موثّقة: كل أنشطة جدول واحد تُجدوَل ضمن "مساحة إزاحة" مشتركة واحدة مبنية على
// تقويم الجدول الافتراضي (calendar) لضمان صحة انتشار العلاقات رياضياً. ربط نشاط بتقويم مختلف
// (calendar_id خاص به) يبقى معلوماتياً حالياً (يُخزَّن ويُعرض) دون التأثير في حساب المسار
// الحرج نفسه - جدولة فعلية بتقاويم مختلفة متشابكة لكل نشاط ميزة متقدمة مؤجَّلة لمرحلة لاحقة.
// =============================================================================

import { buildCalendarIndex, todayStr } from './calendar.js';

/**
 * يحسب الجدول الزمني الكامل (ES/EF/LS/LF/Float/المسار الحرج) لمجموعة أنشطة وعلاقات.
 * @param {Object} params
 * @param {Array} params.activities - صفوف sch_activities (id, parent_id, activity_type, duration_days, planned_start, progress_pct, status)
 * @param {Array} params.relationships - صفوف sch_relationships (predecessor_id, successor_id, rel_type, lag_days)
 * @param {string} params.scheduleAnchorDate - تاريخ إرساء الجدول (عادة data_date أو تاريخ بداية المشروع)
 * @param {Object} params.calendar - تقويم مُطبَّع من normalizeCalendar()
 */
export function computeCriticalPath({ activities, relationships, scheduleAnchorDate, calendar }) {
  const anchor = scheduleAnchorDate || todayStr();
  const index = buildCalendarIndex(calendar, anchor);

  const schedulable = activities.filter((a) => a.activity_type !== 'summary');
  const byId = new Map(schedulable.map((a) => [a.id, a]));

  const rels = (relationships || []).filter((r) => byId.has(r.predecessor_id) && byId.has(r.successor_id));

  const predsOf = new Map();
  const succsOf = new Map();
  for (const a of schedulable) {
    predsOf.set(a.id, []);
    succsOf.set(a.id, []);
  }
  for (const r of rels) {
    predsOf.get(r.successor_id).push({ id: r.predecessor_id, type: r.rel_type || 'FS', lag: Number(r.lag_days) || 0 });
    succsOf.get(r.predecessor_id).push({ id: r.successor_id, type: r.rel_type || 'FS', lag: Number(r.lag_days) || 0 });
  }

  // --- الترتيب الطوبولوجي (خوارزمية Kahn) + كشف الدورات ---
  const inDegree = new Map(schedulable.map((a) => [a.id, predsOf.get(a.id).length]));
  const queue = schedulable.filter((a) => inDegree.get(a.id) === 0).map((a) => a.id);
  const order = [];
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    for (const s of succsOf.get(id)) {
      inDegree.set(s.id, inDegree.get(s.id) - 1);
      if (inDegree.get(s.id) === 0) queue.push(s.id);
    }
  }
  if (order.length !== schedulable.length) {
    return { ok: false, error: 'يحتوي الجدول على علاقات دائرية (Circular Dependency) بين الأنشطة - يجب حلّها قبل حساب المسار الحرج.' };
  }

  const durationOf = (a) => (a.activity_type === 'milestone' ? 0 : Math.max(0, Number(a.duration_days) || 0));

  // --- التمريرة الأمامية: ES/EF ---
  const es = new Map();
  const ef = new Map();
  for (const id of order) {
    const a = byId.get(id);
    const duration = durationOf(a);
    const preds = predsOf.get(id);
    let start;
    if (preds.length === 0) {
      start = a.planned_start ? index.offsetOf(a.planned_start) : 0;
    } else {
      let maxConstraint = -Infinity;
      for (const p of preds) {
        const predEs = es.get(p.id);
        const predEf = ef.get(p.id);
        let c;
        if (p.type === 'SS') c = predEs + p.lag;
        else if (p.type === 'FF') c = predEf + p.lag - duration;
        else if (p.type === 'SF') c = predEs + p.lag - duration;
        else c = predEf + p.lag; // FS (افتراضي)
        if (c > maxConstraint) maxConstraint = c;
      }
      start = maxConstraint;
    }
    es.set(id, start);
    ef.set(id, start + duration);
  }

  const projectEndOffset = order.length ? Math.max(0, ...Array.from(ef.values())) : 0;

  // --- التمريرة الخلفية: LS/LF ---
  const ls = new Map();
  const lf = new Map();
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    const a = byId.get(id);
    const duration = durationOf(a);
    const succs = succsOf.get(id);
    let start;
    if (succs.length === 0) {
      start = projectEndOffset - duration;
    } else {
      let minLs = Infinity;
      for (const s of succs) {
        const succLs = ls.get(s.id);
        const succLf = lf.get(s.id);
        let c;
        if (s.type === 'SS') c = succLs - s.lag;
        else if (s.type === 'FF') c = succLf - s.lag - duration;
        else if (s.type === 'SF') c = succLf - s.lag;
        else c = succLs - s.lag - duration; // FS (افتراضي)
        if (c < minLs) minLs = c;
      }
      start = minLs;
    }
    ls.set(id, start);
    lf.set(id, start + duration);
  }

  // --- Free Float: أقصى تأخر ممكن دون التأثير على الجدول المبكر (ES) لأي تابع ---
  const freeFloat = new Map();
  for (const id of order) {
    const a = byId.get(id);
    const duration = durationOf(a);
    const succs = succsOf.get(id);
    const totalFloat = ls.get(id) - es.get(id);
    if (succs.length === 0) {
      freeFloat.set(id, totalFloat);
      continue;
    }
    let minEfBound = Infinity;
    for (const s of succs) {
      const succEs = es.get(s.id);
      const succEf = ef.get(s.id);
      let bound;
      if (s.type === 'SS') bound = succEs - s.lag + duration;
      else if (s.type === 'FF') bound = succEf - s.lag;
      else if (s.type === 'SF') bound = succEf - s.lag + duration;
      else bound = succEs - s.lag; // FS (افتراضي)
      if (bound < minEfBound) minEfBound = bound;
    }
    const ff = minEfBound - ef.get(id);
    // الطفو الحر لا يتجاوز رياضياً الطفو الكلي أبداً - سقف احترازي لأي انحراف حسابي طفيف
    freeFloat.set(id, Math.min(ff, totalFloat));
  }

  const criticalIds = new Set(order.filter((id) => Math.round(ls.get(id) - es.get(id)) <= 0));

  const computedById = new Map();
  for (const id of order) {
    const a = byId.get(id);
    const esOffset = es.get(id);
    const efOffset = ef.get(id);
    const lsOffset = ls.get(id);
    const lfOffset = lf.get(id);
    computedById.set(id, {
      id,
      esOffset,
      efOffset,
      lsOffset,
      lfOffset,
      // نهاية حصرية (exclusive) - لموضع الشريط في Gantt وسلامة انتشار العلاقات حسابياً
      earlyStart: index.dateOf(esOffset),
      earlyFinish: index.dateOf(efOffset),
      lateStart: index.dateOf(lsOffset),
      lateFinish: index.dateOf(lfOffset),
      // نهاية شاملة (inclusive) - آخر يوم عمل فعلي، للعرض النصي في النماذج/التقارير/planned_end
      earlyFinishInclusive: index.dateOf(Math.max(esOffset, efOffset - 1)),
      lateFinishInclusive: index.dateOf(Math.max(lsOffset, lfOffset - 1)),
      totalFloatDays: round2(ls.get(id) - es.get(id)),
      freeFloatDays: round2(freeFloat.get(id)),
      isCritical: criticalIds.has(id),
      durationDays: durationOf(a),
      progressPct: Number(a.progress_pct) || 0,
    });
  }

  rollUpSummaries(activities, computedById);

  return {
    ok: true,
    scheduleAnchorDate: index.anchorDateStr,
    projectEndOffset,
    projectEndDate: index.dateOf(projectEndOffset),
    projectDurationWorkingDays: projectEndOffset,
    criticalActivityIds: Array.from(criticalIds),
    schedule: Array.from(computedById.values()),
  };
}

/** يلخّص تواريخ/تقدّم/حرَجية عقد WBS الأب (summary) من أبنائها المباشرين وغير المباشرين، من الأعمق نحو الجذر. */
function rollUpSummaries(activities, computedById) {
  const byId = new Map(activities.map((a) => [a.id, a]));
  const childrenOf = new Map();
  for (const a of activities) {
    if (a.parent_id != null) {
      if (!childrenOf.has(a.parent_id)) childrenOf.set(a.parent_id, []);
      childrenOf.get(a.parent_id).push(a.id);
    }
  }
  const depthOf = (id) => {
    let d = 0;
    let cur = byId.get(id);
    let guard = 0;
    while (cur?.parent_id != null && guard < 50) {
      d += 1;
      cur = byId.get(cur.parent_id);
      guard += 1;
    }
    return d;
  };
  const summaryIds = activities.filter((a) => a.activity_type === 'summary').map((a) => a.id);
  summaryIds.sort((a, b) => depthOf(b) - depthOf(a));

  for (const sid of summaryIds) {
    const childIds = childrenOf.get(sid) || [];
    const childResults = childIds.map((cid) => computedById.get(cid)).filter(Boolean);
    if (childResults.length === 0) continue;
    const minEs = Math.min(...childResults.map((c) => c.esOffset));
    const maxEf = Math.max(...childResults.map((c) => c.efOffset));
    const anyCritical = childResults.some((c) => c.isCritical);
    const weight = childResults.reduce((s, c) => s + Math.max(0.01, c.durationDays), 0);
    const weightedProgress = childResults.reduce((s, c) => s + c.progressPct * Math.max(0.01, c.durationDays), 0) / weight;
    const earliestChild = childResults.reduce((min, c) => (c.esOffset < min.esOffset ? c : min), childResults[0]);
    const latestChild = childResults.reduce((max, c) => (c.efOffset > max.efOffset ? c : max), childResults[0]);
    computedById.set(sid, {
      id: sid,
      esOffset: minEs,
      efOffset: maxEf,
      lsOffset: null,
      lfOffset: null,
      earlyStart: earliestChild.earlyStart,
      earlyFinish: latestChild.earlyFinish,
      lateStart: null,
      lateFinish: null,
      totalFloatDays: null,
      freeFloatDays: null,
      isCritical: anyCritical,
      durationDays: round2(maxEf - minEs),
      progressPct: round2(weightedProgress),
      isSummaryRollup: true,
    });
  }
}

/** الأنشطة غير المكتملة المتجاوزة لتاريخها المخطط - بفارق أيام تقويمية بسيطة (يطابق دلالة القسم الرابع لسهولة المقارنة). */
export function findDelayedActivities(activities, asOfDateStr) {
  const asOf = asOfDateStr || todayStr();
  return activities
    .filter((a) => a.status !== 'completed' && a.planned_end && a.planned_end < asOf)
    .map((a) => ({ ...a, delayDays: diffCalendarDays(a.planned_end, asOf) }));
}

function diffCalendarDays(fromDateStr, toDateStr) {
  const from = new Date(fromDateStr + 'T00:00:00Z');
  const to = new Date(toDateStr + 'T00:00:00Z');
  return Math.round((to - from) / 86400000);
}

function round2(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return n;
  return Math.round(n * 100) / 100;
}
