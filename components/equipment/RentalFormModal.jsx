'use client';
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { FieldGroup, TextField, NumberField } from '@/components/ui/Field.jsx';
import { DateField, TextAreaField } from '@/components/pm/PmField.jsx';
import { createRental } from '@/lib/equipmentApi.js';

const EMPTY = { rental_company: '', contract_no: '', rental_start: '', rental_end: '', rental_cost_total: '', hourly_cost: '', terms: '', insurance_info: '' };

export default function RentalFormModal({ open, onClose, onSaved, equipmentId }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { if (open) { setForm(EMPTY); setError(null); } }, [open]);

  function set(field) { return (v) => setForm((f) => ({ ...f, [field]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      await createRental({ ...form, equipment_id: equipmentId });
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-navy-900/40" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line sticky top-0 bg-white">
          <h2 className="font-bold text-ink">عقد إيجار جديد</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-line text-ink-soft"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="text-sm text-fail bg-fail/10 rounded-md px-3 py-2">{error}</div>}
          <TextField label="شركة التأجير" value={form.rental_company} onChange={set('rental_company')} required />
          <FieldGroup cols={2}>
            <TextField label="رقم العقد" value={form.contract_no} onChange={set('contract_no')} />
            <DateField label="بداية الإيجار" value={form.rental_start} onChange={set('rental_start')} required />
            <DateField label="نهاية الإيجار" value={form.rental_end} onChange={set('rental_end')} />
            <NumberField label="إجمالي تكلفة العقد" value={form.rental_cost_total} onChange={set('rental_cost_total')} required={false} />
            <NumberField label="تكلفة الساعة" value={form.hourly_cost} onChange={set('hourly_cost')} required={false} />
          </FieldGroup>
          <TextAreaField label="شروط العقد" value={form.terms} onChange={set('terms')} rows={2} />
          <TextAreaField label="بيانات التأمين" value={form.insurance_info} onChange={set('insurance_info')} rows={2} />
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="text-sm font-medium px-4 py-2 rounded-md border border-line text-ink hover:bg-line/50">إلغاء</button>
            <button type="submit" disabled={saving} className="text-sm font-medium px-4 py-2 rounded-md bg-navy text-white hover:bg-navy-600 disabled:opacity-50">{saving ? 'جارٍ الحفظ...' : 'حفظ'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
