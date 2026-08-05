'use client';
import { useEffect, useState } from 'react';
import { Plus, XCircle, CheckCircle2 } from 'lucide-react';
import { Section, EmptyState } from '@/components/pm/Shared.jsx';
import { FieldGroup, TextField, NumberField, SelectField } from '@/components/ui/Field.jsx';
import { DateField } from '@/components/pm/PmField.jsx';
import StatusBadge from '@/components/equipment/StatusBadge.jsx';
import {
  listReservations, createReservation, confirmReservation, cancelReservation,
  listAssignments, createAssignment, completeAssignment, cancelAssignment,
} from '@/lib/equipmentApi.js';

export default function ReservationsTab({ equipment, onChanged }) {
  const [reservations, setReservations] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showResvForm, setShowResvForm] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    const [r, a] = await Promise.all([
      listReservations({ equipment_id: equipment.id, pageSize: 30 }),
      listAssignments({ equipment_id: equipment.id, pageSize: 30 }),
    ]);
    setReservations(r.rows || []);
    setAssignments(a.rows || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [equipment.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      {error && <div className="text-sm text-fail bg-fail/10 rounded-md px-3 py-2">{error}</div>}

      <Section title={`الحجوزات (${reservations.length})`} action={
        <button onClick={() => setShowResvForm(true)} className="flex items-center gap-1.5 text-xs font-medium text-navy hover:underline"><Plus size={13} /> حجز جديد</button>
      }>
        {!loading && reservations.length === 0 && <EmptyState title="لا توجد حجوزات" />}
        <div className="space-y-2">
          {reservations.map((r) => (
            <div key={r.id} className="rounded-md border border-line p-3 text-sm flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="font-medium text-ink">{r.project_name}</span>
                <span className="text-ink-soft mr-2">{r.start_date} → {r.end_date}</span>
                <StatusBadge status={r.status} />
              </div>
              {['pending', 'confirmed'].includes(r.status) && (
                <div className="flex items-center gap-2">
                  {r.status === 'pending' && <button onClick={async () => { await confirmReservation(r.id); load(); }} className="text-xs text-navy">تأكيد</button>}
                  <button onClick={async () => { await cancelReservation(r.id); load(); }} className="text-xs text-fail flex items-center gap-1"><XCircle size={12} /> إلغاء</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section title={`التخصيص على المشاريع (${assignments.length})`} action={
        <button onClick={() => setShowAssignForm(true)} className="flex items-center gap-1.5 text-xs font-medium text-navy hover:underline"><Plus size={13} /> تخصيص جديد</button>
      }>
        {!loading && assignments.length === 0 && <EmptyState title="لا يوجد تخصيص مسجّل" />}
        <div className="space-y-2">
          {assignments.map((a) => (
            <div key={a.id} className="rounded-md border border-line p-3 text-sm flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="font-medium text-ink">{a.project_name}</span>
                <span className="text-ink-soft mr-2">{a.start_date} → {a.end_date || 'مستمر'}</span>
                {a.operator_name && <span className="text-xs text-ink-soft">المشغل: {a.operator_name}</span>}
                <StatusBadge status={a.status} />
              </div>
              {a.status === 'active' && (
                <div className="flex items-center gap-2">
                  <button onClick={async () => { await completeAssignment(a.id); load(); onChanged?.(); }} className="text-xs text-pass flex items-center gap-1"><CheckCircle2 size={12} /> إنهاء</button>
                  <button onClick={async () => { await cancelAssignment(a.id); load(); onChanged?.(); }} className="text-xs text-fail flex items-center gap-1"><XCircle size={12} /> إلغاء</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      {showResvForm && (
        <ReservationFormModal equipment={equipment} onClose={() => setShowResvForm(false)}
          onSaved={() => { setShowResvForm(false); load(); }} onError={setError} />
      )}
      {showAssignForm && (
        <AssignmentFormModal equipment={equipment} onClose={() => setShowAssignForm(false)}
          onSaved={() => { setShowAssignForm(false); load(); onChanged?.(); }} onError={setError} />
      )}
    </div>
  );
}

function ReservationFormModal({ equipment, onClose, onSaved, onError }) {
  const [form, setForm] = useState({ project_id: equipment.current_project_id || '', activity: '', start_date: '', end_date: '', planned_hours: '', responsible: '' });
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');
  function set(k) { return (v) => setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    if (!form.project_id || !form.start_date || !form.end_date) { setLocalError('المشروع وتاريخ البداية والنهاية مطلوبة.'); return; }
    setSaving(true); setLocalError('');
    try { await createReservation({ ...form, equipment_id: equipment.id }); onSaved(); }
    catch (err) { onError(err.message); setLocalError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-navy-900/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl p-5">
        <h3 className="font-bold text-ink mb-4">حجز {equipment.name}</h3>
        {localError && <div className="text-sm text-fail bg-fail/10 rounded-md px-3 py-2 mb-3">{localError}</div>}
        <div className="space-y-3">
          <NumberField label="رقم المشروع (project_id)" value={form.project_id} onChange={set('project_id')} />
          <TextField label="النشاط" value={form.activity} onChange={set('activity')} />
          <FieldGroup cols={2}>
            <DateField label="تاريخ البداية" value={form.start_date} onChange={set('start_date')} required />
            <DateField label="تاريخ النهاية" value={form.end_date} onChange={set('end_date')} required />
          </FieldGroup>
          <FieldGroup cols={2}>
            <NumberField label="ساعات الاستخدام المتوقعة" value={form.planned_hours} onChange={set('planned_hours')} required={false} />
            <TextField label="المسؤول" value={form.responsible} onChange={set('responsible')} />
          </FieldGroup>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-md border border-line text-sm">إلغاء</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-md bg-navy text-white text-sm disabled:opacity-60">{saving ? 'جارِ الحفظ…' : 'حجز'}</button>
        </div>
      </div>
    </div>
  );
}

function AssignmentFormModal({ equipment, onClose, onSaved, onError }) {
  const [form, setForm] = useState({ project_id: equipment.current_project_id || '', activity: '', location: equipment.current_location || '', start_date: new Date().toISOString().slice(0, 10), end_date: '' });
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');
  function set(k) { return (v) => setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    if (!form.project_id || !form.start_date) { setLocalError('المشروع وتاريخ البداية مطلوبان.'); return; }
    setSaving(true); setLocalError('');
    try { await createAssignment({ ...form, equipment_id: equipment.id }); onSaved(); }
    catch (err) { onError(err.message); setLocalError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-navy-900/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl p-5">
        <h3 className="font-bold text-ink mb-4">تخصيص {equipment.name} لمشروع</h3>
        {localError && <div className="text-sm text-fail bg-fail/10 rounded-md px-3 py-2 mb-3">{localError}</div>}
        <div className="space-y-3">
          <NumberField label="رقم المشروع (project_id)" value={form.project_id} onChange={set('project_id')} />
          <TextField label="النشاط" value={form.activity} onChange={set('activity')} />
          <TextField label="الموقع" value={form.location} onChange={set('location')} />
          <FieldGroup cols={2}>
            <DateField label="تاريخ البداية" value={form.start_date} onChange={set('start_date')} required />
            <DateField label="تاريخ النهاية (اختياري)" value={form.end_date} onChange={set('end_date')} />
          </FieldGroup>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-md border border-line text-sm">إلغاء</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-md bg-navy text-white text-sm disabled:opacity-60">{saving ? 'جارِ الحفظ…' : 'تخصيص'}</button>
        </div>
      </div>
    </div>
  );
}
