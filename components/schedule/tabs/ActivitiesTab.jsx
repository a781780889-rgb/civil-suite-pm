'use client';
// components/schedule/tabs/ActivitiesTab.jsx — إدارة الأنشطة وهيكل تقسيم العمل (WBS).
import { useMemo, useState } from 'react';
import { Plus, ChevronDown, ChevronLeft, GripVertical, Flame, Trash2 } from 'lucide-react';
import { schActivities } from '@/lib/scheduleApi.js';
import { ACTIVITY_TYPE_LABELS } from '@/lib/scheduleApi.js';
import { TaskStatusBadge, PriorityBadge } from '@/components/pm/StatusBadge.jsx';
import { EmptyState, ConfirmDialog } from '@/components/pm/Shared.jsx';
import ActivityDetailPanel from '@/components/schedule/ActivityDetailPanel.jsx';

function buildTree(activities) {
  const byParent = new Map();
  for (const a of activities) {
    const key = a.parent_id ?? 'root';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(a);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.sequence - b.sequence);
  return byParent;
}

export default function ActivitiesTab({ schedule, activities, relationships, onChanged }) {
  const [expanded, setExpanded] = useState(() => new Set(activities.filter((a) => a.activity_type === 'summary').map((a) => a.id)));
  const [selectedId, setSelectedId] = useState(null);
  const [creatingUnder, setCreatingUnder] = useState(undefined); // undefined = مغلق، null = جذر، رقم = تحت أب
  const [dragId, setDragId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const tree = useMemo(() => buildTree(activities), [activities]);
  const byId = useMemo(() => new Map(activities.map((a) => [a.id, a])), [activities]);

  function toggle(id) {
    setExpanded((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  async function handleDrop(targetId, position) {
    if (dragId == null || dragId === targetId) { setDragId(null); return; }
    const target = targetId == null ? null : byId.get(targetId);
    let newParentId, siblings;
    if (position === 'inside') {
      newParentId = targetId;
      siblings = (tree.get(targetId) || []).filter((s) => s.id !== dragId);
    } else {
      newParentId = target?.parent_id ?? null;
      siblings = (tree.get(newParentId ?? 'root') || []).filter((s) => s.id !== dragId);
    }
    const dragIndex = target ? siblings.findIndex((s) => s.id === targetId) : siblings.length;
    const insertAt = position === 'after' ? dragIndex + 1 : dragIndex < 0 ? siblings.length : dragIndex;
    const ordered = [...siblings];
    ordered.splice(Math.max(0, insertAt), 0, { id: dragId });
    const items = ordered.map((s, idx) => ({ id: s.id, parent_id: newParentId, sequence: idx }));
    setDragId(null);
    const res = await schActivities.reorder(schedule.id, items);
    if (res.success) onChanged();
  }

  async function removeActivity(id) {
    await schActivities.remove(id);
    setConfirmDeleteId(null);
    if (selectedId === id) setSelectedId(null);
    onChanged();
  }

  function renderNode(node, depth) {
    const children = tree.get(node.id) || [];
    const isExpanded = expanded.has(node.id);
    const preds = relationships.filter((r) => r.successor_id === node.id).length;

    return (
      <div key={node.id}>
        <div
          draggable
          onDragStart={() => setDragId(node.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleDrop(node.id, e.shiftKey ? 'inside' : 'after'); }}
          onClick={() => setSelectedId(node.id)}
          className={`group flex items-center gap-1.5 py-1.5 pl-2 border-b border-line/60 cursor-pointer hover:bg-navy-50/40 transition-colors ${selectedId === node.id ? 'bg-navy-50' : ''}`}
          style={{ paddingRight: `${depth * 20 + 8}px` }}
        >
          <GripVertical size={13} className="text-concrete-300 opacity-0 group-hover:opacity-100 shrink-0" />
          {children.length > 0 ? (
            <button onClick={(e) => { e.stopPropagation(); toggle(node.id); }} className="shrink-0 text-ink-soft">
              {isExpanded ? <ChevronDown size={14} /> : <ChevronLeft size={14} />}
            </button>
          ) : <span className="w-3.5 shrink-0" />}

          <span className="font-mono text-[10px] text-ink-soft shrink-0 w-12">{node.wbs_code}</span>
          {!!node.is_critical && <Flame size={12} className="text-rebar-500 shrink-0" title="على المسار الحرج" />}
          <span className={`truncate text-sm ${node.activity_type === 'summary' ? 'font-bold text-navy-700' : 'text-ink'}`}>{node.name}</span>
          {node.activity_type === 'milestone' && <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-rebar-50 text-rebar-700">معلَم</span>}

          <span className="mr-auto flex items-center gap-2 shrink-0 pl-2">
            {preds > 0 && <span className="text-[10px] text-ink-soft font-mono">{preds} علاقة</span>}
            <span className="text-[11px] font-mono text-ink-soft w-8 text-left" dir="ltr">{node.progress_pct}%</span>
            <PriorityBadge priority={node.priority} />
            <TaskStatusBadge status={node.status} />
            <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(node.id); }} className="opacity-0 group-hover:opacity-100 text-concrete-400 hover:text-fail-600 transition-colors">
              <Trash2 size={13} />
            </button>
          </span>
        </div>
        {isExpanded && children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  }

  const roots = tree.get('root') || [];

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 rounded-sheet border border-line bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-line bg-paper/50">
          <span className="text-sm font-bold text-navy-700">هيكل تقسيم العمل (WBS)</span>
          <div className="flex gap-2">
            <button onClick={() => setCreatingUnder(null)} className="flex items-center gap-1 text-xs font-medium text-navy-600 hover:underline"><Plus size={13} /> مرحلة/نشاط جذري</button>
          </div>
        </div>
        {roots.length === 0 ? (
          <div className="p-6"><EmptyState title="لا أنشطة بعد" message="أضف أول نشاط أو مرحلة لبدء بناء الجدول." /></div>
        ) : (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (e.target === e.currentTarget) handleDrop(null, 'after'); }}
          >
            {roots.map((n) => renderNode(n, 0))}
          </div>
        )}
        <p className="text-[10px] text-ink-soft px-4 py-2 border-t border-line">اسحب أي نشاط وأفلته على آخر لنقله بعده في نفس المستوى، أو مع الضغط على Shift لجعله ابناً له.</p>
      </div>

      <div>
        {(selectedId != null || creatingUnder !== undefined) ? (
          <ActivityDetailPanel
            key={selectedId ?? `new-${creatingUnder}`}
            schedule={schedule}
            activity={selectedId != null ? byId.get(selectedId) : null}
            parentId={creatingUnder}
            allActivities={activities}
            relationships={relationships}
            onClose={() => { setSelectedId(null); setCreatingUnder(undefined); }}
            onSaved={() => { onChanged(); }}
          />
        ) : (
          <EmptyState title="اختر نشاطاً" message="اختر نشاطاً من القائمة لعرض/تعديل تفاصيله وعلاقاته، أو أضف نشاطاً جديداً." />
        )}
      </div>

      <ConfirmDialog
        open={confirmDeleteId != null}
        title="حذف النشاط؟"
        message="سيُحذف هذا النشاط وكل أبنائه وعلاقاته وتعييناته - لا يمكن التراجع."
        confirmLabel="حذف"
        onConfirm={() => removeActivity(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
