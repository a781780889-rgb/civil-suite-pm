'use client';
// components/schedule/MiniCalendar.jsx — تقويم زمني تفاعلي حقيقي (تنقّل بين الأشهر + تمييز
// أيام بداية/نهاية الأنشطة الفعلية المُمرَّرة) - جزء من لوحة تحكم القسم الخامس.

import { useMemo, useState } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';

const WEEKDAYS = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export default function MiniCalendar({ activities = [] }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });

  const eventsByDate = useMemo(() => {
    const map = new Map();
    for (const a of activities) {
      if (a.planned_start) push(map, a.planned_start, { ...a, kind: 'start' });
      if (a.planned_end) push(map, a.planned_end, { ...a, kind: 'end' });
    }
    return map;
  }, [activities]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = new Date().toISOString().slice(0, 10);

  const cells = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);

  function dateStrFor(day) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="p-1 rounded hover:bg-paper text-ink-soft"><ChevronRight size={16} /></button>
        <span className="text-sm font-bold text-navy-700">{MONTHS_AR[month]} {year}</span>
        <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="p-1 rounded hover:bg-paper text-ink-soft"><ChevronLeft size={16} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-[10px] text-ink-soft font-medium py-1">{w}</div>
        ))}
        {cells.map((day, idx) => {
          if (day === null) return <div key={`e${idx}`} />;
          const ds = dateStrFor(day);
          const events = eventsByDate.get(ds) || [];
          const isToday = ds === todayStr;
          const hasCritical = events.some((e) => e.is_critical);
          return (
            <div
              key={ds}
              title={events.map((e) => `${e.kind === 'start' ? 'بداية' : 'نهاية'}: ${e.name}`).join('\n')}
              className={`relative rounded-md py-1.5 text-[11px] font-mono ${isToday ? 'bg-navy-600 text-white font-bold' : events.length ? 'bg-navy-50 text-navy-700' : 'text-ink-soft'}`}
            >
              {day}
              {events.length > 0 && (
                <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${hasCritical ? 'bg-rebar-500' : 'bg-navy-400'}`} />
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-ink-soft mt-2 flex items-center gap-3">
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rebar-500 inline-block" /> نشاط حرج</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-navy-400 inline-block" /> نشاط عادي</span>
      </p>
    </div>
  );
}

function push(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}
