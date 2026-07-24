'use client';
// components/pm/tabs/RisksTab.jsx

import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { pmRisks } from '@/lib/pmApi.js';
import { TextField, SelectField, NumberField, FieldGroup } from '@/components/ui/Field.jsx';
import { DateField, TextAreaField } from '@/components/pm/PmField.jsx';
import { Section, EmptyState, ConfirmDialog } from '@/components/pm/Shared.jsx';
import { GenericStatusBadge } from '@/components/pm/StatusBadge.jsx';

const STATUS_LABELS = { open: 'مفتوح', mitigated: 'تحت المعالجة', closed: 'مغلق' };
const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));
const SCALE = [1, 2, 3, 4, 5];

export default function RisksTab({ projectId }) {
  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function load() {
    setLoading(true);
    const res = await pmRisks.list(projectId);
    setLoading(false);
    if (res.success) setRisks(res.risks);
  }
  useEffect(() => { load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function remove() {
    await pmRisks.remove(deleteTarget.id);
    setDeleteTarget(null);
    load();
  }

  function severityTone(score) {
    if (score >= 15) return 'bg-fail-50 border-fail-100 text-fail-700';
    if (score >= 8) return 'bg-warnclr-50 border-warnclr-100 text-warnclr-700';
    return 'bg-concrete-100 border-concrete-200 text-concrete-700';
  }

  return (
    <Section title={`سجل المخاطر (${risks.length})`} action={
      <button onClick={() => setEditing({ project_id: projectId, probability: 3, impact: 3, status: 'open' })} className="flex items-center gap-1.5 text-xs font-medium text-navy-700 hover:underline">
        <Plus size={13} /> خطر جديد
      </button>
    }>
      {loading && <p className="text-sm text-ink-soft">جارِ التحميل…</p>}
      {!loading && risks.length === 0 && <EmptyState title="لا توجد مخاطر مسجّلة بعد" />}

      <div className="space-y-2">
        {risks.map((r) => (
          <div key={r.id} className="rounded-md border border-line p-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-[11px] font-bold rounded-full border px-2 py-0.5 shrink-0 ${severityTone(r.severityScore)}`}>{r.severityScore}/25</span>
                <span className="font-medium text-ink text-sm truncate">{r.title}</span>
                <GenericStatusBadge status={r.status} labels={STATUS_LABELS} />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {r.owner && <span className="text-[11px] text-ink-soft">{r.owner}</span>}
                <button onClick={() => setEditing(r)}><Pencil size={13} className="text-ink-soft hover:text-navy-600" /></button>
                <button onClick={() => setDeleteTarget(r)}><Trash2 size={13} className="text-ink-soft hover:text-fail-DEFAULT" /></button>
              </div>
            </div>
            {r.mitigation_plan && <p className="text-xs text-ink-soft mt-1.5">خطة المعالجة: {r.mitigation_plan}</p>}
          </div>
        ))}
      </div>

      {editing && <RiskFormModal risk={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      <ConfirmDialog open={!!deleteTarget} title="حذف الخطر؟" onConfirm={remove} onCancel={() => setDeleteTarget(null)} />
    </Section>
  );
}

function RiskFormModal({ risk, onClose, onSaved }) {
  const isNew = !risk.id;
  const [form, setForm] = useState({ title: '', description: '', cause: '', category: '', probability: 3, impact: 3, owner: '', mitigation_plan: '', status: 'open', review_date: '', ...risk });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    if (!form.title?.trim()) { setError('عنوان الخطر مطلوب.'); return; }
    setSaving(true); setError('');
    const res = isNew ? await pmRisks.create(form) : await pmRisks.update(risk.id, form);
    setSaving(false);
    if (res.success) onSaved();
    else setError(res.error || 'تعذّر الحفظ.');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-sheet border border-line bg-white shadow-sheet p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-navy-700 mb-4">{isNew ? 'خطر جديد' : 'تعديل الخطر'}</h3>
        {error && <p className="text-xs text-fail-700 mb-2">{error}</p>}
        <div className="space-y-3">
          <TextField label="عنوان الخطر" value={form.title} onChange={(v) => set('title', v)} required />
          <TextAreaField label="الوصف" value={form.description} onChange={(v) => set('description', v)} rows={2} />
          <TextField label="السبب" value={form.cause} onChange={(v) => set('cause', v)} />
          <FieldGroup cols={2}>
            <TextField label="التصنيف" value={form.category} onChange={(v) => set('category', v)} placeholder="مالي، فني، جدولة…" />
            <TextField label="المسؤول" value={form.owner} onChange={(v) => set('owner', v)} />
          </FieldGroup>
          <FieldGroup cols={2}>
            <SelectField label="احتمالية الحدوث (1-5)" value={form.probability} onChange={(v) => set('probability', v)} options={SCALE.map((n) => ({ value: n, label: String(n) }))} />
            <SelectField label="درجة التأثير (1-5)" value={form.impact} onChange={(v) => set('impact', v)} options={SCALE.map((n) => ({ value: n, label: String(n) }))} />
          </FieldGroup>
          <TextAreaField label="خطة المعالجة" value={form.mitigation_plan} onChange={(v) => set('mitigation_plan', v)} rows={2} />
          <FieldGroup cols={2}>
            <SelectField label="الحالة" value={form.status} onChange={(v) => set('status', v)} options={STATUS_OPTIONS} />
            <DateField label="تاريخ المراجعة" value={form.review_date} onChange={(v) => set('review_date', v)} />
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
