'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Plus, Trash2, Pencil, AlertTriangle } from 'lucide-react';
import { pmResources } from '@/lib/pmApi.js';
import { TextField, SelectField, NumberField, FieldGroup, ToggleField } from '@/components/ui/Field.jsx';
import { Section, EmptyState, ConfirmDialog, StatCard } from '@/components/pm/Shared.jsx';
import ActorBar from '@/components/pm/ActorBar.jsx';

const TYPE_LABELS = { labor: 'عمالة', equipment: 'معدات', material: 'مواد', vehicle: 'سيارات', warehouse: 'مخازن', tool: 'أدوات' };
const TYPE_OPTIONS = Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }));

export default function ResourcesPoolPage() {
  const [resources, setResources] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [filterType, setFilterType] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function load() {
    setLoading(true);
    const [rRes, cRes] = await Promise.all([pmResources.list({ resource_type: filterType || undefined }), pmResources.allConflicts()]);
    setLoading(false);
    if (rRes.success) setResources(rRes.resources);
    if (cRes.success) setConflicts(cRes.conflicts);
  }
  useEffect(() => { load(); }, [filterType]); // eslint-disable-line react-hooks/exhaustive-deps

  async function remove() {
    await pmResources.remove(deleteTarget.id);
    setDeleteTarget(null);
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Link href="/dashboard/pm" className="inline-flex items-center gap-1 text-xs text-ink-soft hover:text-navy-600 mb-1.5"><ArrowRight size={12} /> إدارة المشاريع</Link>
          <h1 className="text-2xl font-bold text-navy-700">مستودع الموارد</h1>
          <p className="text-ink-soft text-sm mt-1">العمالة والمعدات والمواد والسيارات والمخازن والأدوات - مشتركة بين كل المشاريع.</p>
        </div>
        <div className="flex items-center gap-2">
          <ActorBar />
          <button onClick={() => setEditing({ resource_type: 'equipment', is_active: true })} className="flex items-center gap-1.5 rounded-md bg-navy-700 text-white text-sm font-medium px-4 py-2 hover:bg-navy-800">
            <Plus size={15} /> مورد جديد
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {Object.entries(TYPE_LABELS).map(([key, label]) => (
          <StatCard key={key} label={label} value={resources.filter((r) => r.resource_type === key).length} small />
        ))}
      </div>

      {conflicts.length > 0 && (
        <div className="rounded-sheet border border-fail-100 bg-fail-50 p-4">
          <h2 className="text-sm font-bold text-fail-700 flex items-center gap-1.5 mb-2"><AlertTriangle size={14} /> تعارضات في مواعيد استخدام الموارد ({conflicts.length})</h2>
          <div className="space-y-2">
            {conflicts.map((c) => (
              <div key={c.resource.id} className="text-xs">
                <span className="font-medium text-ink">{c.resource.name}</span>
                {c.conflicts.map((pair, i) => (
                  <span key={i} className="block text-ink-soft mr-3">
                    مشروع #{pair.assignmentA.project_id} ({pair.assignmentA.start_date}→{pair.assignmentA.end_date}) يتعارض مع مشروع #{pair.assignmentB.project_id} ({pair.assignmentB.start_date}→{pair.assignmentB.end_date})
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="rounded-md border border-line px-3 py-2 text-sm">
        <option value="">كل الأنواع</option>
        {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>

      {loading && <p className="text-sm text-ink-soft">جارِ التحميل…</p>}
      {!loading && resources.length === 0 && <EmptyState title="لا توجد موارد بعد" />}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {resources.map((r) => (
          <div key={r.id} className={`rounded-sheet border border-line bg-white p-3 ${!r.is_active ? 'opacity-50' : ''}`}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-medium text-ink text-sm">{r.name}</p>
                <p className="text-[11px] text-navy-600">{TYPE_LABELS[r.resource_type]}{r.identifier ? ` · ${r.identifier}` : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setEditing(r)}><Pencil size={13} className="text-ink-soft hover:text-navy-600" /></button>
                <button onClick={() => setDeleteTarget(r)}><Trash2 size={13} className="text-ink-soft hover:text-fail-DEFAULT" /></button>
              </div>
            </div>
            {r.unit_cost > 0 && <p className="text-[11px] text-ink-soft font-mono tabular-figure mt-1" dir="ltr">{r.unit_cost}/{r.unit || 'وحدة'}</p>}
          </div>
        ))}
      </div>

      {editing && <ResourceFormModal resource={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      <ConfirmDialog open={!!deleteTarget} title="حذف المورد؟" message="سيُحذف مع كل تعييناته على المشاريع." onConfirm={remove} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}

function ResourceFormModal({ resource, onClose, onSaved }) {
  const isNew = !resource.id;
  const [form, setForm] = useState({ resource_type: 'equipment', name: '', identifier: '', unit: '', unit_cost: '', is_active: true, ...resource });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    if (!form.name?.trim()) { setError('اسم المورد مطلوب.'); return; }
    setSaving(true); setError('');
    const res = isNew ? await pmResources.create(form) : await pmResources.update(resource.id, form);
    setSaving(false);
    if (res.success) onSaved();
    else setError(res.error || 'تعذّر الحفظ.');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-sheet border border-line bg-white shadow-sheet p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-navy-700 mb-4">{isNew ? 'مورد جديد' : 'تعديل المورد'}</h3>
        {error && <p className="text-xs text-fail-700 mb-2">{error}</p>}
        <div className="space-y-3">
          <SelectField label="النوع" value={form.resource_type} onChange={(v) => set('resource_type', v)} options={TYPE_OPTIONS} />
          <TextField label="الاسم" value={form.name} onChange={(v) => set('name', v)} required />
          <TextField label="رقم تعريفي (لوحة/رقم تسلسلي)" value={form.identifier} onChange={(v) => set('identifier', v)} />
          <FieldGroup cols={2}>
            <TextField label="الوحدة" value={form.unit} onChange={(v) => set('unit', v)} placeholder="يوم، ساعة، طن…" />
            <NumberField label="تكلفة الوحدة" value={form.unit_cost} onChange={(v) => set('unit_cost', v)} required={false} />
          </FieldGroup>
          <ToggleField label="مورد نشط" checked={!!form.is_active} onChange={(v) => set('is_active', v)} />
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-md border border-line text-sm">إلغاء</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-md bg-navy-700 text-white text-sm disabled:opacity-60">{saving ? 'جارِ الحفظ…' : 'حفظ'}</button>
        </div>
      </div>
    </div>
  );
}
