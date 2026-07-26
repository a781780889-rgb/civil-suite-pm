'use client';
// components/schedule/ActivityDetailPanel.jsx
import { useState } from 'react';
import { Save, X, Link2, Trash2, Flame } from 'lucide-react';
import { schActivities, schRelationships, ACTIVITY_TYPE_LABELS, ACTIVITY_PRIORITY_LABELS, REL_TYPE_LABELS } from '@/lib/scheduleApi.js';
import { TextField, SelectField, NumberField, FieldGroup } from '@/components/ui/Field.jsx';
import { DateField, TextAreaField } from '@/components/pm/PmField.jsx';
import { Section } from '@/components/pm/Shared.jsx';

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'لم يبدأ' }, { value: 'in_progress', label: 'قيد التنفيذ' },
  { value: 'delayed', label: 'متأخر' }, { value: 'completed', label: 'مكتمل' }, { value: 'on_hold', label: 'معلّق' },
];

export default function ActivityDetailPanel({ schedule, activity, parentId, allActivities, relationships, onClose, onSaved }) {
  const isNew = !activity;
  const [form, setForm] = useState(() => ({
    name: activity?.name || '', description: activity?.description || '',
    activity_type: activity?.activity_type || 'task', status: activity?.status || 'not_started',
    priority: activity?.priority || 'medium', responsible: activity?.responsible || '',
    duration_days: activity?.duration_days ?? 1, planned_start: activity?.planned_start || '',
    progress_pct: activity?.progress_pct ?? 0, location: activity?.location || '', notes: activity?.notes || '',
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [newPred, setNewPred] = useState({ predecessor_id: '', rel_type: 'FS', lag_days: 0 });

  async function save() {
    if (!form.name.trim()) { setError('اسم النشاط مطلوب.'); return; }
    setSaving(true);
    setError('');
    const payload = { ...form, parent_id: isNew ? parentId : activity.parent_id };
    const res = isNew ? await schActivities.create(schedule.id, payload) : await schActivities.update(activity.id, payload);
    setSaving(false);
    if (!res.success) { setError(res.error); return; }
    onSaved();
    if (isNew) onClose();
  }

  async function addPredecessor() {
    if (!newPred.predecessor_id) return;
    const res = await schRelationships.create({
      schedule_id: schedule.id, predecessor_id: Number(newPred.predecessor_id),
      successor_id: activity.id, rel_type: newPred.rel_type, lag_days: Number(newPred.lag_days) || 0,
    });
    if (res.success) { setNewPred({ predecessor_id: '', rel_type: 'FS', lag_days: 0 }); onSaved(); }
    else setError(res.error);
  }

  async function removePredecessor(relId) {
    await schRelationships.remove(relId);
    onSaved();
  }

  const predecessors = activity ? relationships.filter((r) => r.successor_id === activity.id) : [];
  const otherActivities = allActivities.filter((a) => a.id !== activity?.id && a.activity_type !== 'summary');

  return (
    <div className="rounded-sheet border border-line bg-white p-4 space-y-4 sticky top-4 max-h-[calc(100vh-6rem)] overflow-y-auto">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-navy-700 text-sm">{isNew ? 'نشاط جديد' : `تعديل: ${activity.name}`}</h3>
        <button onClick={onClose} className="text-ink-soft hover:text-ink"><X size={16} /></button>
      </div>

      {!isNew && activity.is_critical ? (
        <div className="flex items-center gap-1.5 text-xs text-rebar-700 bg-rebar-50 border border-rebar-200 rounded-md px-2.5 py-1.5">
          <Flame size={13} /> على المسار الحرج - أي تأخير هنا يؤخر المشروع كاملاً (طفو = 0)
        </div>
      ) : null}

      <TextField label="اسم النشاط" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} required />
      <TextAreaField label="الوصف" value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} rows={2} />

      <FieldGroup cols={2}>
        <SelectField label="النوع" value={form.activity_type} onChange={(v) => setForm((f) => ({ ...f, activity_type: v }))}
          options={Object.entries(ACTIVITY_TYPE_LABELS).map(([value, label]) => ({ value, label }))} />
        <SelectField label="الأولوية" value={form.priority} onChange={(v) => setForm((f) => ({ ...f, priority: v }))}
          options={Object.entries(ACTIVITY_PRIORITY_LABELS).map(([value, label]) => ({ value, label }))} />
      </FieldGroup>

      <FieldGroup cols={2}>
        <SelectField label="الحالة" value={form.status} onChange={(v) => setForm((f) => ({ ...f, status: v }))} options={STATUS_OPTIONS} />
        <TextField label="المسؤول" value={form.responsible} onChange={(v) => setForm((f) => ({ ...f, responsible: v }))} />
      </FieldGroup>

      <FieldGroup cols={2}>
        {form.activity_type !== 'milestone' && (
          <NumberField label="المدة" unit="يوم عمل" value={form.duration_days} onChange={(v) => setForm((f) => ({ ...f, duration_days: v }))} min={0} />
        )}
        <NumberField label="نسبة الإنجاز" unit="%" value={form.progress_pct} onChange={(v) => setForm((f) => ({ ...f, progress_pct: v }))} min={0} required={false} />
      </FieldGroup>

      <DateField label="بداية مخططة (لنشاط جذري بلا سلف فقط)" value={form.planned_start} onChange={(v) => setForm((f) => ({ ...f, planned_start: v }))} help="تُحسب تلقائياً للأنشطة المرتبطة بعلاقات." />
      <TextField label="الموقع داخل المشروع" value={form.location} onChange={(v) => setForm((f) => ({ ...f, location: v }))} />
      <TextAreaField label="ملاحظات" value={form.notes} onChange={(v) => setForm((f) => ({ ...f, notes: v }))} rows={2} />

      {error && <p className="text-xs text-fail-700">{error}</p>}
      <button onClick={save} disabled={saving} className="flex items-center gap-1.5 rounded-md bg-navy-600 hover:bg-navy-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 w-full justify-center transition-colors">
        <Save size={14} /> {saving ? 'جارِ الحفظ…' : isNew ? 'إنشاء النشاط' : 'حفظ التعديلات'}
      </button>

      {!isNew && (
        <>
          <div className="border-t border-line pt-3 grid grid-cols-2 gap-2 text-[11px] font-mono text-ink-soft" dir="ltr">
            <span>ES: {activity.early_start || '—'}</span>
            <span>EF: {activity.early_finish || '—'}</span>
            <span>LS: {activity.late_start || '—'}</span>
            <span>LF: {activity.late_finish || '—'}</span>
            <span>Total Float: {activity.total_float_days ?? '—'}</span>
            <span>Free Float: {activity.free_float_days ?? '—'}</span>
          </div>

          <Section title="العلاقات (السلف)" className="!p-0 !border-0 !shadow-none">
            <div className="space-y-1.5">
              {predecessors.length === 0 && <p className="text-xs text-ink-soft">لا توجد علاقات سابقة لهذا النشاط.</p>}
              {predecessors.map((r) => {
                const pred = allActivities.find((a) => a.id === r.predecessor_id);
                return (
                  <div key={r.id} className="flex items-center justify-between text-xs bg-paper rounded-md px-2.5 py-1.5">
                    <span className="truncate">{pred?.name || `#${r.predecessor_id}`} <span className="font-mono text-ink-soft">({r.rel_type}{r.lag_days ? `, Lag ${r.lag_days}` : ''})</span></span>
                    <button onClick={() => removePredecessor(r.id)} className="text-concrete-400 hover:text-fail-600 shrink-0"><Trash2 size={12} /></button>
                  </div>
                );
              })}
            </div>
            <div className="flex items-end gap-1.5 mt-2.5">
              <select value={newPred.predecessor_id} onChange={(e) => setNewPred((p) => ({ ...p, predecessor_id: e.target.value }))} className="flex-1 min-w-0 rounded-md border border-line px-2 py-1.5 text-xs">
                <option value="">— اختر نشاطاً سابقاً —</option>
                {otherActivities.map((a) => <option key={a.id} value={a.id}>{a.wbs_code} {a.name}</option>)}
              </select>
              <select value={newPred.rel_type} onChange={(e) => setNewPred((p) => ({ ...p, rel_type: e.target.value }))} className="w-20 rounded-md border border-line px-1.5 py-1.5 text-xs">
                {Object.keys(REL_TYPE_LABELS).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input type="number" value={newPred.lag_days} onChange={(e) => setNewPred((p) => ({ ...p, lag_days: e.target.value }))} placeholder="Lag" className="w-14 rounded-md border border-line px-1.5 py-1.5 text-xs font-mono" />
              <button onClick={addPredecessor} className="shrink-0 rounded-md bg-navy-600 hover:bg-navy-700 text-white p-1.5"><Link2 size={13} /></button>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
