'use client';
import { useEffect, useState } from 'react';
import { Plus, CheckCircle2, XCircle } from 'lucide-react';
import { Section, EmptyState } from '@/components/pm/Shared.jsx';
import { FieldGroup, TextField, NumberField } from '@/components/ui/Field.jsx';
import { DateField } from '@/components/pm/PmField.jsx';
import StatusBadge from '@/components/equipment/StatusBadge.jsx';
import { listTransfers, createTransfer, completeTransfer, cancelTransfer } from '@/lib/equipmentApi.js';

export default function TransfersTab({ equipment, onChanged }) {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    const res = await listTransfers({ equipment_id: equipment.id, pageSize: 30 });
    setTransfers(res.rows || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [equipment.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <Section title={`سجل النقل بين المواقع (${transfers.length})`} action={
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 text-xs font-medium text-navy hover:underline"><Plus size={13} /> نقل جديد</button>
      }>
        {!loading && transfers.length === 0 && <EmptyState title="لم يتم نقل هذه المعدة بعد" />}
        <div className="space-y-2">
          {transfers.map((t) => (
            <div key={t.id} className="rounded-md border border-line p-3 text-sm flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="text-ink-soft">{t.from_location || '—'}</span>
                <span className="mx-2 text-ink-soft">←</span>
                <span className="font-medium text-ink">{t.to_location}</span>
                <span className="text-xs text-ink-soft mr-2">{t.transfer_date}</span>
                <StatusBadge status={t.status} />
              </div>
              {t.status === 'planned' && (
                <div className="flex items-center gap-2">
                  <button onClick={async () => { await completeTransfer(t.id); load(); onChanged?.(); }} className="text-xs text-pass flex items-center gap-1"><CheckCircle2 size={12} /> إتمام النقل</button>
                  <button onClick={async () => { await cancelTransfer(t.id); load(); }} className="text-xs text-fail flex items-center gap-1"><XCircle size={12} /> إلغاء</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      {showForm && <TransferFormModal equipment={equipment} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function TransferFormModal({ equipment, onClose, onSaved }) {
  const [form, setForm] = useState({ from_location: equipment.current_location || '', to_location: '', transfer_date: new Date().toISOString().slice(0, 10), responsible: '', cost: '', transport_method: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  function set(k) { return (v) => setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    if (!form.to_location) { setError('الموقع الجديد مطلوب.'); return; }
    setSaving(true); setError('');
    try { await createTransfer({ ...form, equipment_id: equipment.id }); onSaved(); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-navy-900/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl p-5">
        <h3 className="font-bold text-ink mb-4">نقل {equipment.name}</h3>
        {error && <div className="text-sm text-fail bg-fail/10 rounded-md px-3 py-2 mb-3">{error}</div>}
        <div className="space-y-3">
          <FieldGroup cols={2}>
            <TextField label="من موقع" value={form.from_location} onChange={set('from_location')} />
            <TextField label="إلى موقع" value={form.to_location} onChange={set('to_location')} required />
          </FieldGroup>
          <FieldGroup cols={2}>
            <DateField label="تاريخ النقل" value={form.transfer_date} onChange={set('transfer_date')} required />
            <TextField label="المسؤول" value={form.responsible} onChange={set('responsible')} />
          </FieldGroup>
          <FieldGroup cols={2}>
            <NumberField label="تكلفة النقل" value={form.cost} onChange={set('cost')} required={false} />
            <TextField label="وسيلة النقل" value={form.transport_method} onChange={set('transport_method')} />
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
