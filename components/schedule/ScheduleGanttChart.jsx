'use client';
// components/schedule/ScheduleGanttChart.jsx — مخطط جانت احترافي حقيقي: محور تواريخ فعلي،
// تمييز المسار الحرج، خطوط علاقات SVG، تعبئة نسبة الإنجاز، معالم بشكل معيّن، تكبير/تصغير
// (يوم/أسبوع/شهر)، وسحب الشريط لتغيير تاريخ البداية مباشرة (تحديث فوري + إعادة حساب).
// المحور الزمني LTR عمداً (نفس اصطلاح components/pm/GanttChart.jsx) حتى ضمن الواجهة RTL -
// التواريخ/الأشرطة تجري يساراً⇐يميناً كأي جدول زمني، وعمود الأسماء نفسه يبقى RTL طبيعياً.

import { useMemo, useRef, useState } from 'react';
import { schActivities } from '@/lib/scheduleApi.js';

const ZOOM_LEVELS = { day: 34, week: 14, month: 5 };

function toDate(s) { return new Date(s + 'T00:00:00Z'); }
function diffDays(a, b) { return Math.round((toDate(b) - toDate(a)) / 86400000); }
function addDays(s, n) { const d = toDate(s); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function fmt(d, zoom) {
  const dt = toDate(d);
  if (zoom === 'month') return dt.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function flattenTree(activities) {
  const byParent = new Map();
  for (const a of activities) {
    const key = a.parent_id ?? 'root';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(a);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.sequence - b.sequence);
  const out = [];
  function walk(key, depth) {
    for (const node of byParent.get(key) || []) {
      out.push({ ...node, depth });
      walk(node.id, depth + 1);
    }
  }
  walk('root', 0);
  return out;
}

export default function ScheduleGanttChart({ schedule, activities, relationships, onChanged }) {
  const [zoom, setZoom] = useState('week');
  const [dragState, setDragState] = useState(null); // { id, startX, originalStart, days }
  const pxPerDay = ZOOM_LEVELS[zoom];
  const rowHeight = 30;

  const rows = useMemo(() => flattenTree(activities), [activities]);
  const rowIndexById = useMemo(() => new Map(rows.map((r, i) => [r.id, i])), [rows]);

  const { minDate, totalDays } = useMemo(() => {
    const starts = activities.map((a) => a.planned_start || a.early_start).filter(Boolean);
    const ends = activities.map((a) => a.planned_end || a.early_finish).filter(Boolean);
    if (!starts.length) return { minDate: new Date().toISOString().slice(0, 10), totalDays: 30 };
    const min = starts.sort()[0];
    const max = ends.sort().slice(-1)[0] || min;
    return { minDate: addDays(min, -2), totalDays: Math.max(20, diffDays(min, max) + 8) };
  }, [activities]);

  const headerTicks = useMemo(() => {
    const ticks = [];
    const step = zoom === 'day' ? 1 : zoom === 'week' ? 7 : 30;
    for (let i = 0; i <= totalDays; i += step) ticks.push({ offset: i, date: addDays(minDate, i) });
    return ticks;
  }, [minDate, totalDays, zoom]);

  function barGeometry(a) {
    const start = a.planned_start || a.early_start;
    const end = a.planned_end || a.early_finish || start;
    if (!start) return null;
    const left = diffDays(minDate, start) * pxPerDay;
    const width = Math.max(pxPerDay * 0.6, (diffDays(start, end) + 1) * pxPerDay);
    return { left, width };
  }

  function onBarMouseDown(e, activity) {
    if (activity.activity_type === 'summary') return;
    e.stopPropagation();
    setDragState({ id: activity.id, startX: e.clientX, originalStart: activity.planned_start || activity.early_start, days: 0 });
  }
  function onMouseMove(e) {
    if (!dragState) return;
    const deltaPx = e.clientX - dragState.startX;
    const days = Math.round(deltaPx / pxPerDay);
    setDragState((d) => ({ ...d, days }));
  }
  async function onMouseUp() {
    if (!dragState || dragState.days === 0) { setDragState(null); return; }
    const newStart = addDays(dragState.originalStart, dragState.days);
    setDragState(null);
    await schActivities.update(dragState.id, { planned_start: newStart });
    onChanged();
  }

  return (
    <div className="rounded-sheet border border-line bg-white overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-line bg-paper/50">
        <span className="text-sm font-bold text-navy-700">مخطط جانت</span>
        <div className="flex items-center gap-1 text-xs">
          {['day', 'week', 'month'].map((z) => (
            <button key={z} onClick={() => setZoom(z)} className={`px-2 py-1 rounded ${zoom === z ? 'bg-navy-600 text-white' : 'text-ink-soft hover:bg-white'}`}>
              {z === 'day' ? 'يوم' : z === 'week' ? 'أسبوع' : 'شهر'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex">
        {/* عمود الأسماء (RTL طبيعي) */}
        <div className="w-56 shrink-0 border-l border-line">
          <div style={{ height: 32 }} className="border-b border-line bg-paper/50" />
          {rows.map((r) => (
            <div key={r.id} style={{ height: rowHeight, paddingRight: `${r.depth * 14 + 8}px` }} className="flex items-center border-b border-line/60 text-xs truncate">
              <span className={r.activity_type === 'summary' ? 'font-bold text-navy-700' : 'text-ink'}>{r.name}</span>
            </div>
          ))}
        </div>

        {/* المخطط الزمني - LTR عمداً */}
        <div className="overflow-x-auto flex-1" dir="ltr" onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={() => dragState && onMouseUp()}>
          <div style={{ width: totalDays * pxPerDay, position: 'relative' }}>
            <div style={{ height: 32 }} className="border-b border-line bg-paper/50 relative">
              {headerTicks.map((t) => (
                <div key={t.offset} style={{ position: 'absolute', left: t.offset * pxPerDay, borderLeft: '1px solid #DBDDD8', height: '100%' }} className="text-[10px] text-ink-soft px-1 pt-1.5 whitespace-nowrap">
                  {fmt(t.date, zoom)}
                </div>
              ))}
            </div>

            <svg width={totalDays * pxPerDay} height={rows.length * rowHeight} className="absolute top-8 left-0 pointer-events-none">
              {relationships.map((rel) => {
                const pIdx = rowIndexById.get(rel.predecessor_id);
                const sIdx = rowIndexById.get(rel.successor_id);
                if (pIdx == null || sIdx == null) return null;
                const pred = rows[pIdx]; const succ = rows[sIdx];
                const pg = barGeometry(pred); const sg = barGeometry(succ);
                if (!pg || !sg) return null;
                const y1 = pIdx * rowHeight + rowHeight / 2;
                const y2 = sIdx * rowHeight + rowHeight / 2;
                const x1 = pg.left + pg.width;
                const x2 = sg.left;
                const midX = (x1 + x2) / 2;
                return (
                  <path key={rel.id} d={`M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`} fill="none" stroke={succ.is_critical && pred.is_critical ? '#D9581F' : '#B6BCBC'} strokeWidth={1.5} markerEnd="url(#sch-arrow)" />
                );
              })}
              <defs>
                <marker id="sch-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#8B9296" />
                </marker>
              </defs>
            </svg>

            <div style={{ position: 'relative' }}>
              {rows.map((r) => {
                const geo = barGeometry(r);
                const isDragging = dragState?.id === r.id;
                const shiftPx = isDragging ? dragState.days * pxPerDay : 0;
                if (!geo) return <div key={r.id} style={{ height: rowHeight }} className="border-b border-line/60" />;
                const leftPos = geo.left + shiftPx;
                if (r.activity_type === 'milestone') {
                  return (
                    <div key={r.id} style={{ height: rowHeight }} className="border-b border-line/60 relative">
                      <div
                        style={{ left: leftPos - 6, top: rowHeight / 2 - 6 }}
                        className={`absolute w-3 h-3 rotate-45 ${r.is_critical ? 'bg-rebar-500' : 'bg-navy-600'}`}
                        title={r.name}
                      />
                    </div>
                  );
                }
                return (
                  <div key={r.id} style={{ height: rowHeight }} className="border-b border-line/60 relative">
                    <div
                      onMouseDown={(e) => onBarMouseDown(e, r)}
                      style={{ left: leftPos, width: geo.width, top: 6, height: rowHeight - 12 }}
                      className={`absolute rounded overflow-hidden ${r.activity_type === 'summary' ? 'bg-navy-800' : r.is_critical ? 'bg-rebar-500' : 'bg-navy-400'} cursor-ew-resize`}
                      title={`${r.name} (${r.planned_start} -> ${r.planned_end})`}
                    >
                      {r.activity_type !== 'summary' && (
                        <div className="h-full bg-white/30" style={{ width: `${Math.max(0, Math.min(100, r.progress_pct))}%` }} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <p className="text-[10px] text-ink-soft px-3 py-2 border-t border-line">اسحب أي شريط أفقياً لتغيير تاريخ بدايته - سيُعاد حساب المسار الحرج تلقائياً. اللون البرتقالي = على المسار الحرج.</p>
    </div>
  );
}
