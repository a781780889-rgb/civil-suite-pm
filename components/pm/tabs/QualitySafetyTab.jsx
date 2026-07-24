'use client';
// components/pm/tabs/QualitySafetyTab.jsx

import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { pmQuality, pmSafety } from '@/lib/pmApi.js';
import { TextField, SelectField, FieldGroup } from '@/components/ui/Field.jsx';
import { DateField, TextAreaField } from '@/components/pm/PmField.jsx';
import { Section, EmptyState, ConfirmDialog } from '@/components/pm/Shared.jsx';
import { GenericStatusBadge, SeverityBadge } from '@/components/pm/StatusBadge.jsx';

const QUALITY_TYPES = { plan: 'خطة جودة', inspection: 'فحص', material_test: 'اختبار مواد', approval: 'اعتماد', rejection: 'رفض', corrective_action: 'إجراء تصحيحي' };
const SAFETY_TYPES = { plan: 'خطة سلامة', incident: 'حادث', injury: 'إصابة', inspection: 'تفتيش', permit: 'تصريح عمل', violation: 'مخالفة' };
const STATUS_LABELS = { open: 'مفتوح', closed: 'مغلق', in_progress: 'قيد المعالجة' };

export default function QualitySafetyTab({ projectId }) {
  return (
    <div className="space-y-4">
      <RecordSection kind="quality" projectId={projectId} title="الجودة" typeLabels={QUALITY_TYPES} api={pmQuality} />
      <RecordSection kind="safety" projectId={projectId} title="السلامة" typeLabels={SAFETY_TYPES} api={pmSafety} />
    </div>
  );
}

function RecordSection({ kind, projectId, title, typeLabels, api }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function load() {
    setLoading(true);
    const res = await api.list(projectId);
    setLoading(false);
    if (res.success) setRecords(res.records);
  }
  useEffect(() => { load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function remove() {
    await api.remove(deleteTarget.id);
    setDeleteTarget(null);
    load();
  }

  return (
    <Section title={`${title} (${records.length})`} action={
      <button onClick={() => setEditing({ project_id: projectId, record_type: Object.keys(typeLabels)[1], status: 'open' })} className="flex items-center gap-1.5 text-xs font-medium text-navy-700 hover:underline">
        <Plus size={13} /> سجل جديد
      </button>
    }>
      {loading && <p className="text-sm text-ink-soft">جارِ التحميل…</p>}
      {!loading && records.length === 0 && <EmptyState title={`لا توجد سجلات ${title} بعد`} />}
      <div className="space-y-1.5">
        {records.map((r) => (
          <div key={r.id} className="rounded-md border border-line p-2.5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] text-navy-600 shrink-0">{typeLabels[r.record_type] || r.record_type}</span>
              <span className="font-medium text-ink text-sm truncate">{r.title}</span>
              <GenericStatusBadge status={r.status} labels={STATUS_LABELS} />
              {kind === 'safety' && r.severity && <SeverityBadge severity={r.severity} />}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {r.record_date && <span className="text-[11px] text-ink-soft font-mono tabular-figure" dir="ltr">{r.record_date}</span>}
              <button onClick={() => setEditing(r)}><Pencil size={13} className="text-ink-soft hover:text-navy-600" /></button>
              <button onClick={() => setDeleteTarget(r)}><Trash2 size={13} className="text-ink-soft hover:text-fail-DEFAULT" /></button>
            </div>
          </div>
        ))}
      </div>

      {editing && <RecordFormModal kind={kind} record={editing} typeLabels={typeLabels} api={api} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      <ConfirmDialog open={!!deleteTarget} title="حذف السجل؟" onConfirm={remove} onCancel={() => setDeleteTarget(null)} />
    </Section>
  );
}

function RecordFormModal({ kind, record, typeLabels, api, onClose, onSaved }) {
  const isNew = !record.id;
  const [form, setForm] = useState({ record_type: Object.keys(typeLabels)[0], title: '', description: '', responsible: '', record_date: '', status: 'open', corrective_action: '', severity: 'low', result: '', ...record });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    if (!form.title?.trim()) { setError('العنوان مطلوب.'); return; }
    setSaving(true); setError('');
    const res = isNew ? await api.create(form) : await api.update(record.id, form);
    setSaving(false);
    if (res.success) onSaved();
    else setError(res.error || 'تعذّر الحفظ.');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-sheet border border-line bg-white shadow-sheet p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-navy-700 mb-4">{isNew ? 'سجل جديد' : 'تعديل السجل'}</h3>
        {error && <p className="text-xs text-fail-700 mb-2">{error}</p>}
        <div className="space-y-3">
          <FieldGroup cols={2}>
            <SelectField label="النوع" value={form.record_type} onChange={(v) => set('record_type', v)} options={Object.entries(typeLabels).map(([value, label]) => ({ value, label }))} />
            <DateField label="التاريخ" value={form.record_date} onChange={(v) => set('record_date', v)} />
          </FieldGroup>
          <TextField label="العنوان" value={form.title} onChange={(v) => set('title', v)} required />
          <TextAreaField label="الوصف" value={form.description} onChange={(v) => set('description', v)} rows={2} />
          {kind === 'quality' && <TextField label="النتيجة" value={form.result} onChange={(v) => set('result', v)} />}
          {kind === 'safety' && (
            <SelectField label="الخطورة" value={form.severity} onChange={(v) => set('severity', v)} options={[{ value: 'low', label: 'منخفضة' }, { value: 'medium', label: 'متوسطة' }, { value: 'high', label: 'عالية' }]} />
          )}
          <TextField label="المسؤول" value={form.responsible} onChange={(v) => set('responsible', v)} />
          <TextAreaField label="الإجراء التصحيحي" value={form.corrective_action} onChange={(v) => set('corrective_action', v)} rows={2} />
          <SelectField label="الحالة" value={form.status} onChange={(v) => set('status', v)} options={[{ value: 'open', label: 'مفتوح' }, { value: 'in_progress', label: 'قيد المعالجة' }, { value: 'closed', label: 'مغلق' }]} />
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-md border border-line text-sm">إلغاء</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-md bg-navy-700 text-white text-sm disabled:opacity-60">{saving ? 'جارِ الحفظ…' : 'حفظ'}</button>
        </div>
      </div>
    </div>
  );
}
