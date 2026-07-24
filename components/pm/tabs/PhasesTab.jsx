'use client';
// components/pm/tabs/PhasesTab.jsx

import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { pmPhases } from '@/lib/pmApi.js';
import { TextField, SelectField, FieldGroup } from '@/components/ui/Field.jsx';
import { DateField } from '@/components/pm/PmField.jsx';
import { Section, EmptyState, ConfirmDialog } from '@/components/pm/Shared.jsx';
import { GenericStatusBadge } from '@/components/pm/StatusBadge.jsx';

const STATUS_LABELS = { not_started: 'لم تبدأ', in_progress: 'قيد التنفيذ', completed: 'مكتملة', on_hold: 'معلّقة' };
const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));

export default function PhasesTab({ projectId }) {
  const [phases, setPhases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null=closed, {}=new, {...}=edit
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function load() {
    setLoading(true);
    const res = await pmPhases.list(projectId);
    setLoading(false);
    if (res.success) setPhases(res.phases);
  }
  useEffect(() => { load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function remove() {
    await pmPhases.remove(deleteTarget.id);
    setDeleteTarget(null);
    load();
  }

  return (
    <Section title={`المراحل (${phases.length})`} action={
      <button onClick={() => setEditing({ project_id: projectId, name: '', status: 'not_started' })} className="flex items-center gap-1.5 text-xs font-medium text-navy-700 hover:underline">
        <Plus size={13} /> مرحلة جديدة
      </button>
    }>
      {loading && <p className="text-sm text-ink-soft">جارِ التحميل…</p>}
      {!loading && phases.length === 0 && <EmptyState title="لا توجد مراحل بعد" message="أضف مراحل المشروع مثل الدراسة، التصميم، التنفيذ، التسليم." />}

      <div className="space-y-2">
        {phases.map((p) => (
          <div key={p.id} className="rounded-md border border-line p-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium text-ink text-sm truncate">{p.name}</span>
                <GenericStatusBadge status={p.status} labels={STATUS_LABELS} />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-ink-soft font-mono tabular-figure" dir="ltr">{p.planned_start || '—'} → {p.planned_end || '—'}</span>
                <button onClick={() => setEditing(p)}><Pencil size={13} className="text-ink-soft hover:text-navy-600" /></button>
                <button onClick={() => setDeleteTarget(p)}><Trash2 size={13} className="text-ink-soft hover:text-fail-DEFAULT" /></button>
              </div>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-paper overflow-hidden">
              <div className="h-full bg-navy-500" style={{ width: `${Math.min(100, p.progress_pct)}%` }} />
            </div>
            <p className="text-[11px] text-ink-soft mt-1 font-mono tabular-figure" dir="ltr">{p.progress_pct}%</p>
          </div>
        ))}
      </div>

      {editing && <PhaseFormModal phase={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      <ConfirmDialog open={!!deleteTarget} title="حذف المرحلة؟" message="ستُفصل المهام المرتبطة بها دون حذفها." onConfirm={remove} onCancel={() => setDeleteTarget(null)} />
    </Section>
  );
}

function PhaseFormModal({ phase, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', status: 'not_started', planned_start: '', planned_end: '', responsible: '', notes: '', ...phase });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isNew = !phase.id;

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    if (!form.name?.trim()) { setError('اسم المرحلة مطلوب.'); return; }
    setSaving(true); setError('');
    const res = isNew ? await pmPhases.create(form) : await pmPhases.update(phase.id, form);
    setSaving(false);
    if (res.success) onSaved();
    else setError(res.error || 'تعذّر الحفظ.');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-sheet border border-line bg-white shadow-sheet p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-navy-700 mb-4">{isNew ? 'مرحلة جديدة' : 'تعديل المرحلة'}</h3>
        {error && <p className="text-xs text-fail-700 mb-2">{error}</p>}
        <div className="space-y-3">
          <TextField label="اسم المرحلة" value={form.name} onChange={(v) => set('name', v)} required />
          <FieldGroup cols={2}>
            <DateField label="تاريخ البداية المخطط" value={form.planned_start} onChange={(v) => set('planned_start', v)} />
            <DateField label="تاريخ النهاية المخطط" value={form.planned_end} onChange={(v) => set('planned_end', v)} />
          </FieldGroup>
          <FieldGroup cols={2}>
            <SelectField label="الحالة" value={form.status} onChange={(v) => set('status', v)} options={STATUS_OPTIONS} />
            <TextField label="المسؤول" value={form.responsible} onChange={(v) => set('responsible', v)} />
          </FieldGroup>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-md border border-line text-sm">إلغاء</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-md bg-navy-700 text-white text-sm disabled:opacity-60">{saving ? 'جارِ الحفظ…' : 'حفظ'}</button>
        </div>
      </div>
    </div>
  );
}
