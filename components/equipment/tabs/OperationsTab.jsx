'use client';
import { useEffect, useState } from 'react';
import { Plus, Gauge } from 'lucide-react';
import { Section, EmptyState, StatCard } from '@/components/pm/Shared.jsx';
import { FieldGroup, TextField, NumberField, SelectField } from '@/components/ui/Field.jsx';
import { DateField, TextAreaField } from '@/components/pm/PmField.jsx';
import { TimeField } from '@/components/equipment/EquipmentField.jsx';
import { listOperationLogs, createOperationLog, listOperators, recordHourMeterReading } from '@/lib/equipmentApi.js';

export default function OperationsTab({ equipment, onChanged }) {
  const [logs, setLogs] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showMeterForm, setShowMeterForm] = useState(false);

  async function load() {
    setLoading(true);
    const [logsRes, opsRes] = await Promise.all([
      listOperationLogs({ equipment_id: equipment.id, pageSize: 50 }),
      listOperators({ is_active: true, pageSize: 100 }),
    ]);
    setLogs(logsRes.rows || []);
    setOperators(opsRes.rows || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [equipment.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalHours = logs.reduce((s, l) => s + Number(l.hours || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="عداد الساعات الحالي" value={equipment.current_hour_meter ?? 0} icon={Gauge} />
        <StatCard label="إجمالي الساعات المسجّلة" value={totalHours.toFixed(1)} small />
        <StatCard label="عدد جلسات التشغيل" value={logs.length} small />
      </div>

      <Section title={`سجل التشغيل (${logs.length})`} action={
        <div className="flex items-center gap-3">
          <button onClick={() => setShowMeterForm(true)} className="text-xs font-medium text-ink-soft hover:underline">تحديث قراءة العداد يدوياً</button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 text-xs font-medium text-navy hover:underline">
            <Plus size={13} /> تسجيل تشغيل جديد
          </button>
        </div>
      }>
        {loading && <p className="text-sm text-ink-soft">جارِ التحميل...</p>}
        {!loading && logs.length === 0 && <EmptyState title="لا توجد سجلات تشغيل بعد" />}
        <div className="space-y-2">
          {logs.map((l) => (
            <div key={l.id} className="rounded-md border border-line p-3 text-sm">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink">{l.log_date}</span>
                  <span className="text-ink-soft">{l.hours} ساعة</span>
                  {l.activity && <span className="text-ink-soft">— {l.activity}</span>}
                </div>
                {l.operator_name && <span className="text-xs text-ink-soft">المشغل: {l.operator_name}</span>}
              </div>
              {(l.fuel_used_l || l.productivity_qty) && (
                <div className="text-xs text-ink-soft mt-1">
                  {l.fuel_used_l ? `وقود: ${l.fuel_used_l} لتر` : ''} {l.productivity_qty ? `· إنتاجية: ${l.productivity_qty} ${l.productivity_unit || ''}` : ''}
                </div>
              )}
              {l.notes && <p className="text-xs text-ink-soft mt-1">{l.notes}</p>}
            </div>
          ))}
        </div>
      </Section>

      {showForm && (
        <OperationLogFormModal equipment={equipment} operators={operators} onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); onChanged?.(); }} />
      )}
      {showMeterForm && (
        <HourMeterFormModal equipment={equipment} onClose={() => setShowMeterForm(false)}
          onSaved={() => { setShowMeterForm(false); load(); onChanged?.(); }} />
      )}
    </div>
  );
}

function OperationLogFormModal({ equipment, operators, onClose, onSaved }) {
  const [form, setForm] = useState({ log_date: new Date().toISOString().slice(0, 10), start_time: '', end_time: '', hours: '', activity: '', operator_id: '', productivity_qty: '', productivity_unit: '', fuel_used_l: '', end_hour_meter: equipment.current_hour_meter || '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  function set(k) { return (v) => setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    setSaving(true); setError('');
    try {
      await createOperationLog({ ...form, equipment_id: equipment.id, operator_id: form.operator_id || null });
      onSaved();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-navy-900/40" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl p-5">
        <h3 className="font-bold text-ink mb-4">تسجيل تشغيل جديد - {equipment.name}</h3>
        {error && <div className="text-sm text-fail bg-fail/10 rounded-md px-3 py-2 mb-3">{error}</div>}
        <div className="space-y-3">
          <FieldGroup cols={2}>
            <DateField label="التاريخ" value={form.log_date} onChange={set('log_date')} required />
            <SelectField label="المشغل" value={form.operator_id} onChange={set('operator_id')} options={operators.map((o) => ({ value: o.id, label: o.name }))} required={false} />
          </FieldGroup>
          <FieldGroup cols={2}>
            <TimeField label="وقت البداية" value={form.start_time} onChange={set('start_time')} />
            <TimeField label="وقت النهاية" value={form.end_time} onChange={set('end_time')} />
          </FieldGroup>
          <NumberField label="عدد الساعات (إن لم يُحسب تلقائياً من الوقت)" value={form.hours} onChange={set('hours')} required={false} />
          <TextField label="النشاط" value={form.activity} onChange={set('activity')} />
          <FieldGroup cols={2}>
            <NumberField label="الإنتاجية (كمية)" value={form.productivity_qty} onChange={set('productivity_qty')} required={false} />
            <TextField label="وحدة الإنتاجية" value={form.productivity_unit} onChange={set('productivity_unit')} placeholder="م³، طن..." />
          </FieldGroup>
          <FieldGroup cols={2}>
            <NumberField label="الوقود المستهلك (لتر)" value={form.fuel_used_l} onChange={set('fuel_used_l')} required={false} />
            <NumberField label="قراءة عداد الساعات عند الانتهاء" value={form.end_hour_meter} onChange={set('end_hour_meter')} required={false} />
          </FieldGroup>
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

function HourMeterFormModal({ equipment, onClose, onSaved }) {
  const [value, setValue] = useState(equipment.current_hour_meter || 0);
  const [overrideReason, setOverrideReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setSaving(true); setError('');
    try {
      const allowBackward = Number(value) < Number(equipment.current_hour_meter || 0);
      await recordHourMeterReading({ equipment_id: equipment.id, reading_value: Number(value), allowBackward, override_reason: overrideReason || undefined });
      onSaved();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-navy-900/40" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-xl shadow-xl p-5">
        <h3 className="font-bold text-ink mb-1">تحديث قراءة عداد الساعات</h3>
        <p className="text-xs text-ink-soft mb-4">القراءة الحالية: {equipment.current_hour_meter ?? 0}</p>
        {error && <div className="text-sm text-fail bg-fail/10 rounded-md px-3 py-2 mb-3">{error}</div>}
        <NumberField label="القراءة الجديدة" value={value} onChange={setValue} />
        {Number(value) < Number(equipment.current_hour_meter || 0) && (
          <div className="mt-2">
            <TextField label="سبب إدخال قراءة أقل من السابقة (مطلوب)" value={overrideReason} onChange={setOverrideReason} />
          </div>
        )}
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-md border border-line text-sm">إلغاء</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-md bg-navy text-white text-sm disabled:opacity-60">{saving ? 'جارِ الحفظ…' : 'حفظ'}</button>
        </div>
      </div>
    </div>
  );
}
