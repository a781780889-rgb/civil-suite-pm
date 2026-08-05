'use client';
import { useEffect, useState } from 'react';
import { Plus, Wrench, AlertTriangle } from 'lucide-react';
import { Section, EmptyState, StatCard } from '@/components/pm/Shared.jsx';
import { FieldGroup, TextField, NumberField, SelectField } from '@/components/ui/Field.jsx';
import { DateField, TextAreaField } from '@/components/pm/PmField.jsx';
import StatusBadge, { SeverityBadge } from '@/components/equipment/StatusBadge.jsx';
import { SEVERITY_OPTIONS } from '@/lib/equipmentConstants.js';
import { listBreakdowns, createBreakdown, resolveBreakdown } from '@/lib/equipmentApi.js';

export default function BreakdownsTab({ equipment, onChanged }) {
  const [breakdowns, setBreakdowns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [resolving, setResolving] = useState(null);

  async function load() {
    setLoading(true);
    const res = await listBreakdowns({ equipment_id: equipment.id, pageSize: 50 });
    setBreakdowns(res.rows || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [equipment.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCount = breakdowns.filter((b) => b.status !== 'resolved').length;
  const totalCost = breakdowns.reduce((s, b) => s + Number(b.total_cost || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="أعطال مفتوحة" value={openCount} icon={AlertTriangle} tone={openCount > 0 ? 'fail' : 'navy'} />
        <StatCard label="إجمالي عدد الأعطال" value={breakdowns.length} small />
        <StatCard label="إجمالي تكلفة الإصلاح" value={totalCost.toFixed(2)} small />
      </div>

      <Section title={`سجل الأعطال (${breakdowns.length})`} action={
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 text-xs font-medium text-navy hover:underline">
          <Plus size={13} /> تسجيل عطل
        </button>
      }>
        {loading && <p className="text-sm text-ink-soft">جارِ التحميل...</p>}
        {!loading && breakdowns.length === 0 && <EmptyState title="لا توجد أعطال مسجّلة - سجل جيد" />}
        <div className="space-y-2">
          {breakdowns.map((b) => (
            <div key={b.id} className="rounded-md border border-line p-3 text-sm">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs text-ink-soft">{b.report_no}</span>
                  <SeverityBadge severity={b.severity} />
                  <StatusBadge status={b.status} />
                </div>
                {b.status !== 'resolved' && (
                  <button onClick={() => setResolving(b)} className="flex items-center gap-1 text-xs text-navy hover:underline">
                    <Wrench size={12} /> تسجيل الإصلاح
                  </button>
                )}
              </div>
              <p className="text-ink mt-1.5">{b.description}</p>
              <p className="text-xs text-ink-soft mt-0.5">{b.breakdown_date} {b.total_cost ? `· تكلفة: ${b.total_cost}` : ''}</p>
            </div>
          ))}
        </div>
      </Section>

      {showForm && <BreakdownFormModal equipment={equipment} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); onChanged?.(); }} />}
      {resolving && <ResolveFormModal breakdown={resolving} onClose={() => setResolving(null)} onSaved={() => { setResolving(null); load(); onChanged?.(); }} />}
    </div>
  );
}

function BreakdownFormModal({ equipment, onClose, onSaved }) {
  const [form, setForm] = useState({ description: '', cause: '', severity: 'medium', responsible: '', breakdown_date: new Date().toISOString().slice(0, 10), stop_time: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  function set(k) { return (v) => setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    if (!form.description) { setError('وصف العطل مطلوب.'); return; }
    setSaving(true); setError('');
    try { await createBreakdown({ ...form, equipment_id: equipment.id }); onSaved(); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-navy-900/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl p-5">
        <h3 className="font-bold text-ink mb-4">تسجيل عطل - {equipment.name}</h3>
        {error && <div className="text-sm text-fail bg-fail/10 rounded-md px-3 py-2 mb-3">{error}</div>}
        <div className="space-y-3">
          <TextAreaField label="وصف العطل" value={form.description} onChange={set('description')} rows={2} required />
          <TextField label="السبب المحتمل" value={form.cause} onChange={set('cause')} />
          <FieldGroup cols={2}>
            <SelectField label="درجة الخطورة" value={form.severity} onChange={set('severity')} options={SEVERITY_OPTIONS} />
            <DateField label="تاريخ العطل" value={form.breakdown_date} onChange={set('breakdown_date')} required />
          </FieldGroup>
          <TextField label="المسؤول" value={form.responsible} onChange={set('responsible')} />
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-md border border-line text-sm">إلغاء</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-md bg-fail text-white text-sm disabled:opacity-60">{saving ? 'جارِ الحفظ…' : 'تسجيل العطل'}</button>
        </div>
      </div>
    </div>
  );
}

function ResolveFormModal({ breakdown, onClose, onSaved }) {
  const [form, setForm] = useState({ corrective_action: '', labor_cost: '', resume_time: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  function set(k) { return (v) => setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    setSaving(true); setError('');
    try { await resolveBreakdown(breakdown.id, form); onSaved(); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-navy-900/40" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-xl shadow-xl p-5">
        <h3 className="font-bold text-ink mb-1">تسجيل إصلاح العطل</h3>
        <p className="text-xs text-ink-soft mb-4">{breakdown.report_no} — {breakdown.description}</p>
        {error && <div className="text-sm text-fail bg-fail/10 rounded-md px-3 py-2 mb-3">{error}</div>}
        <div className="space-y-3">
          <TextAreaField label="الإجراء التصحيحي" value={form.corrective_action} onChange={set('corrective_action')} rows={2} />
          <NumberField label="تكلفة العمالة" value={form.labor_cost} onChange={set('labor_cost')} required={false} />
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-md border border-line text-sm">إلغاء</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-md bg-pass text-white text-sm disabled:opacity-60">{saving ? 'جارِ الحفظ…' : 'تأكيد الإصلاح'}</button>
        </div>
      </div>
    </div>
  );
}
