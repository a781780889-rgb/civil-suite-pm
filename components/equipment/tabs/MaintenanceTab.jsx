'use client';
import { useEffect, useState } from 'react';
import { Plus, CheckCircle2, Wrench } from 'lucide-react';
import { Section, EmptyState, StatCard } from '@/components/pm/Shared.jsx';
import { FieldGroup, TextField, NumberField, SelectField } from '@/components/ui/Field.jsx';
import { DateField, TextAreaField } from '@/components/pm/PmField.jsx';
import StatusBadge from '@/components/equipment/StatusBadge.jsx';
import { MAINTENANCE_TYPE_OPTIONS, INTERVAL_TYPE_OPTIONS } from '@/lib/equipmentConstants.js';
import {
  listMaintenanceSchedules, createMaintenanceSchedule, listMaintenanceRecords, createMaintenanceRecord, completeMaintenanceRecord,
} from '@/lib/equipmentApi.js';

export default function MaintenanceTab({ equipment, onChanged }) {
  const [schedules, setSchedules] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showRecordForm, setShowRecordForm] = useState(false);

  async function load() {
    setLoading(true);
    const [s, r] = await Promise.all([
      listMaintenanceSchedules({ equipment_id: equipment.id }),
      listMaintenanceRecords({ equipment_id: equipment.id, pageSize: 50 }),
    ]);
    setSchedules(s.rows || []);
    setRecords(r.rows || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [equipment.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalCost = records.reduce((s, r) => s + Number(r.total_cost || 0), 0);
  const openRecords = records.filter((r) => r.status !== 'completed');

  async function markComplete(id) {
    await completeMaintenanceRecord(id, {});
    load(); onChanged?.();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="إجمالي تكلفة الصيانة" value={totalCost.toFixed(2)} icon={Wrench} />
        <StatCard label="عمليات صيانة مسجّلة" value={records.length} small />
        <StatCard label="صيانة قيد التنفيذ" value={openRecords.length} small />
      </div>

      <Section title={`خطط الصيانة الدورية (${schedules.length})`} action={
        <button onClick={() => setShowScheduleForm(true)} className="flex items-center gap-1.5 text-xs font-medium text-navy hover:underline">
          <Plus size={13} /> خطة جديدة
        </button>
      }>
        {!loading && schedules.length === 0 && <EmptyState title="لا توجد خطة صيانة دورية بعد" />}
        <div className="space-y-2">
          {schedules.map((s) => (
            <div key={s.id} className="rounded-md border border-line p-3 text-sm flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="font-medium text-ink">{s.title}</span>
                <span className="text-xs text-ink-soft mr-2">
                  {s.interval_type === 'hours' ? `كل ${s.interval_hours} ساعة تشغيل` : `كل ${s.interval_days} يوم`}
                </span>
              </div>
              <span className="text-xs text-ink-soft">القادم: {s.next_due_date || (s.next_due_hour_meter ? `عند ${s.next_due_hour_meter} ساعة` : '—')}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title={`سجلات الصيانة الفعلية (${records.length})`} action={
        <button onClick={() => setShowRecordForm(true)} className="flex items-center gap-1.5 text-xs font-medium text-navy hover:underline">
          <Plus size={13} /> تسجيل صيانة
        </button>
      }>
        {loading && <p className="text-sm text-ink-soft">جارِ التحميل...</p>}
        {!loading && records.length === 0 && <EmptyState title="لا توجد سجلات صيانة بعد" />}
        <div className="space-y-2">
          {records.map((r) => (
            <div key={r.id} className="rounded-md border border-line p-3 text-sm">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink">{r.maintenance_date}</span>
                  <span className="text-ink-soft">{r.title}</span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-line text-ink-soft">{r.maintenance_type === 'preventive' ? 'وقائية' : 'تصحيحية'}</span>
                  <StatusBadge status={r.status} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ink-soft">تكلفة: {r.total_cost}</span>
                  {r.status !== 'completed' && (
                    <button onClick={() => markComplete(r.id)} className="text-xs text-pass flex items-center gap-1"><CheckCircle2 size={12} /> إنهاء</button>
                  )}
                </div>
              </div>
              {r.technician && <p className="text-xs text-ink-soft mt-1">الفني: {r.technician}</p>}
            </div>
          ))}
        </div>
      </Section>

      {showScheduleForm && (
        <ScheduleFormModal equipment={equipment} onClose={() => setShowScheduleForm(false)} onSaved={() => { setShowScheduleForm(false); load(); }} />
      )}
      {showRecordForm && (
        <RecordFormModal equipment={equipment} onClose={() => setShowRecordForm(false)} onSaved={() => { setShowRecordForm(false); load(); onChanged?.(); }} />
      )}
    </div>
  );
}

function ScheduleFormModal({ equipment, onClose, onSaved }) {
  const [form, setForm] = useState({ title: '', interval_type: 'hours', interval_hours: '', interval_days: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  function set(k) { return (v) => setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    if (!form.title) { setError('عنوان الخطة مطلوب.'); return; }
    setSaving(true); setError('');
    try { await createMaintenanceSchedule({ ...form, equipment_id: equipment.id }); onSaved(); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-navy-900/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl p-5">
        <h3 className="font-bold text-ink mb-4">خطة صيانة دورية جديدة</h3>
        {error && <div className="text-sm text-fail bg-fail/10 rounded-md px-3 py-2 mb-3">{error}</div>}
        <div className="space-y-3">
          <TextField label="العنوان" value={form.title} onChange={set('title')} placeholder="تغيير زيت المحرك، فحص دوري..." required />
          <SelectField label="أساس التكرار" value={form.interval_type} onChange={set('interval_type')} options={INTERVAL_TYPE_OPTIONS} />
          {form.interval_type === 'hours'
            ? <NumberField label="كل كم ساعة تشغيل" value={form.interval_hours} onChange={set('interval_hours')} />
            : <NumberField label="كل كم يوم" value={form.interval_days} onChange={set('interval_days')} />}
          <TextAreaField label="ملاحظات" value={form.notes} onChange={set('notes')} rows={2} />
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-md border border-line text-sm">إلغاء</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-md bg-navy text-white text-sm disabled:opacity-60">{saving ? 'جارِ الحفظ…' : 'حفظ'}</button>
        </div>
      </div>
    </div>
  );
}

function RecordFormModal({ equipment, onClose, onSaved }) {
  const [form, setForm] = useState({ maintenance_type: 'preventive', title: '', description: '', maintenance_date: new Date().toISOString().slice(0, 10), technician: '', labor_cost: '', downtime_hours: '', status: 'completed' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  function set(k) { return (v) => setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    if (!form.title) { setError('العنوان مطلوب.'); return; }
    setSaving(true); setError('');
    try { await createMaintenanceRecord({ ...form, equipment_id: equipment.id, hour_meter_at_service: equipment.current_hour_meter }); onSaved(); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-navy-900/40" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl p-5">
        <h3 className="font-bold text-ink mb-4">تسجيل صيانة - {equipment.name}</h3>
        {error && <div className="text-sm text-fail bg-fail/10 rounded-md px-3 py-2 mb-3">{error}</div>}
        <div className="space-y-3">
          <FieldGroup cols={2}>
            <SelectField label="نوع الصيانة" value={form.maintenance_type} onChange={set('maintenance_type')} options={MAINTENANCE_TYPE_OPTIONS} />
            <DateField label="تاريخ الصيانة" value={form.maintenance_date} onChange={set('maintenance_date')} required />
          </FieldGroup>
          <TextField label="العنوان" value={form.title} onChange={set('title')} required />
          <TextAreaField label="الوصف" value={form.description} onChange={set('description')} rows={2} />
          <FieldGroup cols={2}>
            <TextField label="الفني المسؤول" value={form.technician} onChange={set('technician')} />
            <NumberField label="تكلفة العمالة" value={form.labor_cost} onChange={set('labor_cost')} required={false} />
          </FieldGroup>
          <FieldGroup cols={2}>
            <NumberField label="ساعات التوقف" value={form.downtime_hours} onChange={set('downtime_hours')} required={false} />
            <SelectField label="الحالة" value={form.status} onChange={set('status')} options={[{ value: 'completed', label: 'مكتملة' }, { value: 'in_progress', label: 'قيد التنفيذ' }]} />
          </FieldGroup>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-md border border-line text-sm">إلغاء</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-md bg-navy text-white text-sm disabled:opacity-60">{saving ? 'جارِ الحفظ…' : 'حفظ'}</button>
        </div>
      </div>
    </div>
  );
}
