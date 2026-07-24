'use client';
// components/pm/tabs/TasksTab.jsx

import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, List, GanttChartSquare, Link as LinkIcon } from 'lucide-react';
import { pmTasks, pmPhases, pmTeam, pmGantt } from '@/lib/pmApi.js';
import { TextField, SelectField, NumberField, FieldGroup } from '@/components/ui/Field.jsx';
import { DateField, TextAreaField } from '@/components/pm/PmField.jsx';
import { Section, EmptyState, ConfirmDialog } from '@/components/pm/Shared.jsx';
import { TaskStatusBadge, PriorityBadge } from '@/components/pm/StatusBadge.jsx';
import GanttChart from '@/components/pm/GanttChart.jsx';

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'لم تبدأ' }, { value: 'in_progress', label: 'قيد التنفيذ' },
  { value: 'delayed', label: 'متأخرة' }, { value: 'completed', label: 'مكتملة' }, { value: 'on_hold', label: 'معلّقة' },
];
const PRIORITY_OPTIONS = [{ value: 'low', label: 'منخفضة' }, { value: 'medium', label: 'متوسطة' }, { value: 'high', label: 'عالية' }, { value: 'critical', label: 'حرجة' }];
const DEP_TYPE_OPTIONS = [
  { value: 'FS', label: 'نهاية → بداية (FS)' }, { value: 'SS', label: 'بداية → بداية (SS)' },
  { value: 'FF', label: 'نهاية → نهاية (FF)' }, { value: 'SF', label: 'بداية → نهاية (SF)' },
];

export default function TasksTab({ projectId, project }) {
  const [tasks, setTasks] = useState([]);
  const [phases, setPhases] = useState([]);
  const [team, setTeam] = useState([]);
  const [view, setView] = useState('list');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [gantt, setGantt] = useState(null);

  async function load() {
    setLoading(true);
    const [tRes, phRes, teamRes] = await Promise.all([pmTasks.list({ project_id: projectId }), pmPhases.list(projectId), pmTeam.list(projectId)]);
    setLoading(false);
    if (tRes.success) setTasks(tRes.tasks);
    if (phRes.success) setPhases(phRes.phases);
    if (teamRes.success) setTeam(teamRes.team);
  }
  useEffect(() => { load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadGantt() {
    const res = await pmGantt.get(projectId);
    if (res.success) setGantt(res);
  }
  useEffect(() => { if (view === 'gantt') loadGantt(); }, [view, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function remove() {
    await pmTasks.remove(deleteTarget.id);
    setDeleteTarget(null);
    load();
  }

  const phaseName = (id) => phases.find((p) => p.id === id)?.name;
  const memberName = (id) => team.find((m) => m.id === id)?.name;
  const tasksById = new Map(tasks.map((t) => [t.id, t]));

  return (
    <Section title={`المهام (${tasks.length})`} action={
      <div className="flex items-center gap-2">
        <div className="flex rounded-md border border-line overflow-hidden">
          <button onClick={() => setView('list')} className={`p-1.5 ${view === 'list' ? 'bg-navy-600 text-white' : 'bg-white text-ink-soft'}`}><List size={14} /></button>
          <button onClick={() => setView('gantt')} className={`p-1.5 ${view === 'gantt' ? 'bg-navy-600 text-white' : 'bg-white text-ink-soft'}`}><GanttChartSquare size={14} /></button>
        </div>
        <button onClick={() => setEditing({ project_id: projectId, status: 'not_started', priority: 'medium' })} className="flex items-center gap-1.5 text-xs font-medium text-navy-700 hover:underline">
          <Plus size={13} /> مهمة جديدة
        </button>
      </div>
    }>
      {loading && <p className="text-sm text-ink-soft">جارِ التحميل…</p>}
      {!loading && tasks.length === 0 && <EmptyState title="لا توجد مهام بعد" message="أضف أول مهمة لبدء تتبع تقدم المشروع." />}

      {!loading && tasks.length > 0 && view === 'list' && (
        <div className="space-y-1.5">
          {tasks.map((t) => (
            <div key={t.id} className={`rounded-md border p-2.5 ${t.parent_task_id ? 'border-line bg-paper/50 mr-5' : 'border-line'}`}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="font-medium text-ink text-sm truncate">{t.title}</span>
                  <TaskStatusBadge status={t.status} />
                  <PriorityBadge priority={t.priority} />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {t.phase_id && <span className="text-[11px] text-ink-soft">{phaseName(t.phase_id)}</span>}
                  {t.assignee_id && <span className="text-[11px] text-navy-600">{memberName(t.assignee_id)}</span>}
                  <span className="text-[11px] text-ink-soft font-mono tabular-figure" dir="ltr">{t.planned_start || '—'} → {t.planned_end || '—'}</span>
                  <button onClick={() => setEditing(t)}><Pencil size={12} className="text-ink-soft hover:text-navy-600" /></button>
                  <button onClick={() => setDeleteTarget(t)}><Trash2 size={12} className="text-ink-soft hover:text-fail-DEFAULT" /></button>
                </div>
              </div>
              <div className="mt-1.5 h-1 rounded-full bg-line overflow-hidden w-40">
                <div className="h-full bg-navy-500" style={{ width: `${Math.min(100, t.progress_pct)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && view === 'gantt' && (
        gantt?.ok === false ? (
          <div className="rounded-md bg-fail-50 border border-fail-100 text-fail-700 text-sm p-3">{gantt.error}</div>
        ) : gantt ? (
          <GanttChart schedule={gantt.schedule} criticalPath={gantt.criticalPath} tasksById={tasksById} projectDurationDays={gantt.projectDurationDays} />
        ) : <p className="text-sm text-ink-soft">جارِ الحساب…</p>
      )}

      {editing && (
        <TaskFormModal
          task={editing} projectId={projectId} phases={phases} team={team} allTasks={tasks}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }}
        />
      )}
      <ConfirmDialog open={!!deleteTarget} title="حذف المهمة؟" message="سيُحذف معها كل مهامها الفرعية وتبعياتها." onConfirm={remove} onCancel={() => setDeleteTarget(null)} />
    </Section>
  );
}

function TaskFormModal({ task, projectId, phases, team, allTasks, onClose, onSaved }) {
  const isNew = !task.id;
  const [form, setForm] = useState({
    title: '', description: '', phase_id: '', parent_task_id: '', assignee_id: '', priority: 'medium', status: 'not_started',
    planned_start: '', planned_end: '', duration_days: '', progress_pct: 0, ...task,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deps, setDeps] = useState([]);
  const [newDep, setNewDep] = useState({ depends_on_task_id: '', dep_type: 'FS', lag_days: 0 });

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  useEffect(() => {
    if (!isNew) pmTasks.get(task.id).then((res) => { if (res.success) setDeps(res.dependencies); });
  }, [task.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!form.title?.trim()) { setError('عنوان المهمة مطلوب.'); return; }
    setSaving(true); setError('');
    const payload = { ...form, project_id: projectId, phase_id: form.phase_id || null, parent_task_id: form.parent_task_id || null, assignee_id: form.assignee_id || null };
    const res = isNew ? await pmTasks.create(payload) : await pmTasks.update(task.id, payload);
    setSaving(false);
    if (res.success) onSaved();
    else setError(res.error || 'تعذّر الحفظ.');
  }

  async function addDependency() {
    if (!newDep.depends_on_task_id) return;
    const res = await pmTasks.addDependency(task.id, newDep);
    if (res.success) setDeps((d) => [...d, res.dependency]);
  }
  async function removeDependency(depId) {
    await pmTasks.removeDependency(task.id, depId);
    setDeps((d) => d.filter((x) => x.id !== depId));
  }

  const otherTasks = allTasks.filter((t) => t.id !== task.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-sheet border border-line bg-white shadow-sheet p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-navy-700 mb-4">{isNew ? 'مهمة جديدة' : 'تعديل المهمة'}</h3>
        {error && <p className="text-xs text-fail-700 mb-2">{error}</p>}
        <div className="space-y-3">
          <TextField label="عنوان المهمة" value={form.title} onChange={(v) => set('title', v)} required />
          <TextAreaField label="الوصف" value={form.description} onChange={(v) => set('description', v)} rows={2} />
          <FieldGroup cols={2}>
            <SelectField label="المرحلة" value={form.phase_id || ''} onChange={(v) => set('phase_id', v)} options={[{ value: '', label: '— بلا مرحلة —' }, ...phases.map((p) => ({ value: String(p.id), label: p.name }))]} />
            <SelectField label="المسؤول" value={form.assignee_id || ''} onChange={(v) => set('assignee_id', v)} options={[{ value: '', label: '— غير مُعيّن —' }, ...team.map((m) => ({ value: String(m.id), label: m.name }))]} />
          </FieldGroup>
          <FieldGroup cols={2}>
            <SelectField label="مهمة رئيسية (اختياري)" value={form.parent_task_id || ''} onChange={(v) => set('parent_task_id', v)} options={[{ value: '', label: '— مهمة رئيسية —' }, ...otherTasks.map((t) => ({ value: String(t.id), label: t.title }))]} />
            <SelectField label="الأولوية" value={form.priority} onChange={(v) => set('priority', v)} options={PRIORITY_OPTIONS} />
          </FieldGroup>
          <FieldGroup cols={2}>
            <DateField label="تاريخ البداية المخطط" value={form.planned_start} onChange={(v) => set('planned_start', v)} />
            <DateField label="تاريخ النهاية المخطط" value={form.planned_end} onChange={(v) => set('planned_end', v)} />
          </FieldGroup>
          <FieldGroup cols={2}>
            <SelectField label="الحالة" value={form.status} onChange={(v) => set('status', v)} options={STATUS_OPTIONS} />
            <NumberField label="نسبة الإنجاز" unit="%" value={form.progress_pct} onChange={(v) => set('progress_pct', v)} min={0} required={false} />
          </FieldGroup>
          {!form.planned_start && !form.planned_end && (
            <NumberField label="المدة (أيام)" value={form.duration_days} onChange={(v) => set('duration_days', v)} required={false} min={0.5} />
          )}

          {!isNew && (
            <div className="rounded-md bg-paper p-3 space-y-2">
              <p className="text-xs font-bold text-navy-700 flex items-center gap-1.5"><LinkIcon size={12} /> التبعيات (يعتمد إنجاز هذه المهمة على)</p>
              {deps.map((d) => (
                <div key={d.id} className="flex items-center justify-between text-xs bg-white rounded px-2 py-1.5">
                  <span>{otherTasks.find((t) => t.id === d.depends_on_task_id)?.title || `#${d.depends_on_task_id}`} — {DEP_TYPE_OPTIONS.find((o) => o.value === d.dep_type)?.label} {d.lag_days ? `+${d.lag_days}ي` : ''}</span>
                  <button onClick={() => removeDependency(d.id)}><Trash2 size={12} className="text-ink-soft hover:text-fail-DEFAULT" /></button>
                </div>
              ))}
              <div className="flex gap-1.5">
                <select value={newDep.depends_on_task_id} onChange={(e) => setNewDep((d) => ({ ...d, depends_on_task_id: e.target.value }))} className="flex-1 rounded border border-line px-2 py-1 text-xs">
                  <option value="">اختر مهمة سابقة…</option>
                  {otherTasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
                <select value={newDep.dep_type} onChange={(e) => setNewDep((d) => ({ ...d, dep_type: e.target.value }))} className="rounded border border-line px-2 py-1 text-xs">
                  {DEP_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.value}</option>)}
                </select>
                <input type="number" value={newDep.lag_days} onChange={(e) => setNewDep((d) => ({ ...d, lag_days: e.target.value }))} className="w-14 rounded border border-line px-2 py-1 text-xs" placeholder="تأخر" />
                <button onClick={addDependency} className="rounded bg-navy-600 text-white px-2 text-xs">إضافة</button>
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-md border border-line text-sm">إلغاء</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-md bg-navy-700 text-white text-sm disabled:opacity-60">{saving ? 'جارِ الحفظ…' : 'حفظ'}</button>
        </div>
      </div>
    </div>
  );
}
