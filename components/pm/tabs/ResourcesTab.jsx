'use client';
// components/pm/tabs/ResourcesTab.jsx — تعيينات الموارد لهذا المشروع (الموارد نفسها تُدار من مستودع عام مشترك).

import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { pmResources } from '@/lib/pmApi.js';
import { SelectField, NumberField, FieldGroup } from '@/components/ui/Field.jsx';
import { DateField, TextAreaField } from '@/components/pm/PmField.jsx';
import { Section, EmptyState, ConfirmDialog } from '@/components/pm/Shared.jsx';

const TYPE_LABELS = { labor: 'عمالة', equipment: 'معدات', material: 'مواد', vehicle: 'سيارات', warehouse: 'مخازن', tool: 'أدوات' };

export default function ResourcesTab({ projectId }) {
  const [assignments, setAssignments] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [conflicts, setConflicts] = useState([]);

  async function load() {
    setLoading(true);
    const [aRes, rRes] = await Promise.all([pmResources.assignments({ project_id: projectId }), pmResources.list({ is_active: true })]);
    setLoading(false);
    if (aRes.success) setAssignments(aRes.assignments);
    if (rRes.success) setResources(rRes.resources);
  }
  useEffect(() => { load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (assignments.length === 0) { setConflicts([]); return; }
    Promise.all(assignments.map((a) => pmResources.conflictsFor(a.resource_id))).then((results) => {
      const flat = results.flatMap((r, i) => (r.success ? r.conflicts.map((c) => ({ ...c, resourceId: assignments[i].resource_id })) : []));
      setConflicts(flat.filter((c) => !c.sameProject || c.assignmentA.project_id !== c.assignmentB.project_id));
    });
  }, [assignments]);

  async function remove() {
    await pmResources.removeAssignment(deleteTarget.id);
    setDeleteTarget(null);
    load();
  }

  return (
    <Section title={`الموارد المُعيّنة (${assignments.length})`} action={
      <div className="flex items-center gap-3">
        <Link href="/dashboard/pm/resources" className="text-xs text-ink-soft hover:text-navy-600">مستودع الموارد العام</Link>
        <button onClick={() => setEditing({ project_id: projectId, quantity: 1 })} className="flex items-center gap-1.5 text-xs font-medium text-navy-700 hover:underline">
          <Plus size={13} /> تعيين مورد
        </button>
      </div>
    }>
      {conflicts.length > 0 && (
        <div className="rounded-md bg-fail-50 border border-fail-100 text-fail-700 text-xs p-3 mb-3 flex items-start gap-2">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>يوجد {conflicts.length} تعارض في مواعيد استخدام موارد بين هذا المشروع ومشاريع أخرى — راجع مستودع الموارد للتفاصيل.</span>
        </div>
      )}
      {loading && <p className="text-sm text-ink-soft">جارِ التحميل…</p>}
      {!loading && assignments.length === 0 && <EmptyState title="لا توجد موارد معيّنة بعد" />}

      <div className="space-y-1.5">
        {assignments.map((a) => (
          <div key={a.id} className="rounded-md border border-line p-2.5 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <span className="font-medium text-ink text-sm">{a.resource_name}</span>
              <span className="text-[11px] text-ink-soft mr-2">{TYPE_LABELS[a.resource_type] || a.resource_type} · كمية {a.quantity}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-ink-soft font-mono tabular-figure" dir="ltr">{a.start_date || '—'} → {a.end_date || '—'}</span>
              <span className="text-xs font-mono tabular-figure text-ink" dir="ltr">{Number(a.cost || 0).toLocaleString('en-US')}</span>
              <button onClick={() => setEditing(a)}><Pencil size={13} className="text-ink-soft hover:text-navy-600" /></button>
              <button onClick={() => setDeleteTarget(a)}><Trash2 size={13} className="text-ink-soft hover:text-fail-DEFAULT" /></button>
            </div>
          </div>
        ))}
      </div>

      {editing && <AssignmentModal assignment={editing} resources={resources} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      <ConfirmDialog open={!!deleteTarget} title="إلغاء تعيين المورد؟" onConfirm={remove} onCancel={() => setDeleteTarget(null)} />
    </Section>
  );
}

function AssignmentModal({ assignment, resources, onClose, onSaved }) {
  const isNew = !assignment.id;
  const [form, setForm] = useState({ resource_id: '', quantity: 1, start_date: '', end_date: '', cost: '', notes: '', ...assignment });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    if (!form.resource_id) { setError('اختر المورد.'); return; }
    setSaving(true); setError('');
    const res = isNew ? await pmResources.assign(form) : await pmResources.updateAssignment(assignment.id, form);
    setSaving(false);
    if (res.success) onSaved();
    else setError(res.error || 'تعذّر الحفظ.');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-sheet border border-line bg-white shadow-sheet p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-navy-700 mb-4">{isNew ? 'تعيين مورد' : 'تعديل التعيين'}</h3>
        {error && <p className="text-xs text-fail-700 mb-2">{error}</p>}
        <div className="space-y-3">
          {isNew && (
            <SelectField label="المورد" value={form.resource_id} onChange={(v) => set('resource_id', v)} options={[{ value: '', label: '— اختر —' }, ...resources.map((r) => ({ value: String(r.id), label: `${r.name} (${TYPE_LABELS[r.resource_type]})` }))]} />
          )}
          <FieldGroup cols={2}>
            <DateField label="من تاريخ" value={form.start_date} onChange={(v) => set('start_date', v)} />
            <DateField label="إلى تاريخ" value={form.end_date} onChange={(v) => set('end_date', v)} />
          </FieldGroup>
          <FieldGroup cols={2}>
            <NumberField label="الكمية" value={form.quantity} onChange={(v) => set('quantity', v)} />
            <NumberField label="التكلفة" value={form.cost} onChange={(v) => set('cost', v)} required={false} />
          </FieldGroup>
          <TextAreaField label="ملاحظات" value={form.notes} onChange={(v) => set('notes', v)} rows={2} />
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-md border border-line text-sm">إلغاء</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-md bg-navy-700 text-white text-sm disabled:opacity-60">{saving ? 'جارِ الحفظ…' : 'حفظ'}</button>
        </div>
      </div>
    </div>
  );
}
