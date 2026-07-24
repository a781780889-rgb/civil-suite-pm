'use client';
// components/pm/GanttChart.jsx — تصور حقيقي لجدول المسار الحرج (CPM) محسوب من lib/pm/criticalPath.js.
// المسار الحرج (Float = 0) يُبرَز بلون rebar (نفس لون "الانتباه" المستخدم في بقية النظام)،
// وبقية المهام بلون navy الهادئ، فوق خلفية blueprint-grid المستخدمة أصلاً في هوية النظام البصرية.

export default function GanttChart({ schedule, criticalPath, tasksById, projectDurationDays }) {
  if (!schedule || schedule.length === 0) {
    return <p className="text-sm text-ink-soft text-center py-8">لا توجد مهام مجدولة بعد لعرض المخطط الزمني.</p>;
  }
  const total = Math.max(1, projectDurationDays);
  const criticalSet = new Set(criticalPath || []);

  return (
    <div className="rounded-md border border-line overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-2 bg-navy-50 border-b border-line text-[11px] text-navy-700">
        <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-rebar-500 inline-block" /> مسار حرج (طفو = صفر)</span>
        <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-navy-400 inline-block" /> نشاط عادي</span>
        <span className="mr-auto font-mono tabular-figure" dir="ltr">إجمالي المدة: {total} يوم</span>
      </div>
      <div className="bg-blueprint-grid">
        {schedule.map((s) => {
          const task = tasksById.get(s.id);
          if (!task) return null;
          const isCritical = criticalSet.has(s.id);
          const leftPct = (s.esDay / total) * 100;
          const widthPct = Math.max(1, ((s.efDay - s.esDay) / total) * 100);
          return (
            <div key={s.id} className="flex items-center border-b border-line/70 last:border-b-0 hover:bg-white/60 transition-colors">
              <div className="w-40 shrink-0 px-2.5 py-2 text-xs font-medium text-ink truncate" title={task.title}>
                {task.title}
              </div>
              <div className="flex-1 relative h-9 px-2" dir="ltr">
                <div className="absolute inset-y-0 my-auto h-5 rounded" style={{ left: `${leftPct}%`, width: `${widthPct}%` }}>
                  <div
                    className={`h-full w-full rounded flex items-center justify-center text-[10px] font-mono text-white shadow-sheet ${isCritical ? 'bg-rebar-500' : 'bg-navy-400'}`}
                    title={`ES:${s.esDay} EF:${s.efDay} LS:${s.lsDay} LF:${s.lfDay} طفو:${s.floatDays}`}
                  >
                    {s.floatDays > 0 ? `طفو ${Math.round(s.floatDays)}` : ''}
                  </div>
                </div>
              </div>
              <div className="w-14 shrink-0 px-2 text-[10px] font-mono tabular-figure text-ink-soft text-left" dir="ltr">
                {Math.round(task.duration_days)}ي
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
