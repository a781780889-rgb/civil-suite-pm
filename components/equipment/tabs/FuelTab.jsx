'use client';
import { useEffect, useState } from 'react';
import { Plus, Fuel } from 'lucide-react';
import { Section, EmptyState, StatCard } from '@/components/pm/Shared.jsx';
import { FieldGroup, TextField, NumberField } from '@/components/ui/Field.jsx';
import { DateField } from '@/components/pm/PmField.jsx';
import { listFuelLogs, createFuelLog } from '@/lib/equipmentApi.js';

export default function FuelTab({ equipment, onChanged }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    const res = await listFuelLogs({ equipment_id: equipment.id, pageSize: 50 });
    setLogs(res.rows || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [equipment.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalLiters = logs.reduce((s, l) => s + Number(l.quantity_l || 0), 0);
  const totalCost = logs.reduce((s, l) => s + Number(l.total_cost || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="إجمالي الوقود المستهلك" value={`${totalLiters.toFixed(0)} لتر`} icon={Fuel} />
        <StatCard label="إجمالي تكلفة الوقود" value={totalCost.toFixed(2)} small />
        <StatCard label="عدد عمليات التعبئة" value={logs.length} small />
      </div>

      <Section title={`سجل الوقود (${logs.length})`} action={
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 text-xs font-medium text-navy hover:underline">
          <Plus size={13} /> تعبئة جديدة
        </button>
      }>
        {loading && <p className="text-sm text-ink-soft">جارِ التحميل...</p>}
        {!loading && logs.length === 0 && <EmptyState title="لا توجد عمليات تعبئة مسجّلة بعد" />}
        <div className="space-y-2">
          {logs.map((l) => (
            <div key={l.id} className="rounded-md border border-line p-3 text-sm flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="font-medium text-ink">{l.fill_date}</span>
                <span className="text-ink-soft mr-2"> — {l.quantity_l} لتر بتكلفة {l.total_cost}</span>
              </div>
              {l.supplier && <span className="text-xs text-ink-soft">{l.supplier}</span>}
            </div>
          ))}
        </div>
      </Section>

      {showForm && (
        <FuelFormModal equipment={equipment} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); onChanged?.(); }} />
      )}
    </div>
  );
}

function FuelFormModal({ equipment, onClose, onSaved }) {
  const [form, setForm] = useState({ fill_date: new Date().toISOString().slice(0, 10), quantity_l: '', price_per_liter: '', supplier: '', hour_meter_reading: equipment.current_hour_meter || '', operation_no: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  function set(k) { return (v) => setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    if (!form.quantity_l) { setError('الكمية مطلوبة.'); return; }
    setSaving(true); setError('');
    try {
      await createFuelLog({ ...form, equipment_id: equipment.id });
      onSaved();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-navy-900/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl p-5">
        <h3 className="font-bold text-ink mb-4">تعبئة وقود - {equipment.name}</h3>
        {error && <div className="text-sm text-fail bg-fail/10 rounded-md px-3 py-2 mb-3">{error}</div>}
        <div className="space-y-3">
          <DateField label="تاريخ التعبئة" value={form.fill_date} onChange={set('fill_date')} required />
          <FieldGroup cols={2}>
            <NumberField label="الكمية (لتر)" value={form.quantity_l} onChange={set('quantity_l')} />
            <NumberField label="سعر اللتر" value={form.price_per_liter} onChange={set('price_per_liter')} required={false} />
          </FieldGroup>
          <FieldGroup cols={2}>
            <TextField label="المورد" value={form.supplier} onChange={set('supplier')} />
            <NumberField label="قراءة العداد" value={form.hour_meter_reading} onChange={set('hour_meter_reading')} required={false} />
          </FieldGroup>
          <TextField label="رقم العملية" value={form.operation_no} onChange={set('operation_no')} />
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-md border border-line text-sm">إلغاء</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-md bg-navy text-white text-sm disabled:opacity-60">{saving ? 'جارِ الحفظ…' : 'حفظ'}</button>
        </div>
      </div>
    </div>
  );
}
