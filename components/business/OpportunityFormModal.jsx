'use client';
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { FieldGroup, TextField, SelectField, NumberField } from '@/components/ui/Field.jsx';
import { DateField, TextAreaField } from '@/components/pm/PmField.jsx';
import { createOpportunity, updateOpportunity, listClients } from '@/lib/businessApi.js';

const EMPTY = { client_id: '', name: '', source: '', expected_value: '', currency: 'SAR', opp_date: '', expected_close_date: '', responsible: '', win_probability: 10, notes: '' };

export default function OpportunityFormModal({ open, onClose, onSaved, opportunity, defaultClientId }) {
  const [form, setForm] = useState(EMPTY);
  const [clients, setClients] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setForm(opportunity ? { ...EMPTY, ...opportunity } : { ...EMPTY, client_id: defaultClientId || '' });
    setError(null);
    listClients({ pageSize: 500 }).then((r) => setClients(r.rows)).catch(() => {});
  }, [open, opportunity, defaultClientId]);

  function set(field) { return (v) => setForm((f) => ({ ...f, [field]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      if (opportunity) await updateOpportunity(opportunity.id, form);
      else await createOpportunity(form);
      onSaved?.();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-navy-900/40" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line sticky top-0 bg-white">
          <h2 className="font-bold text-ink">{opportunity ? 'تعديل الفرصة' : 'فرصة تجارية جديدة'}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-line text-ink-soft"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="text-sm text-fail bg-fail/10 rounded-md px-3 py-2">{error}</div>}
          <FieldGroup cols={1}>
            <TextField label="اسم الفرصة" value={form.name} onChange={set('name')} required />
            <SelectField label="العميل المحتمل" value={form.client_id} onChange={set('client_id')} options={[{ value: '', label: 'اختر عميلاً...' }, ...clients.map((c) => ({ value: c.id, label: c.name }))]} />
          </FieldGroup>
          <FieldGroup cols={2}>
            <NumberField label="القيمة المتوقعة" value={form.expected_value} onChange={set('expected_value')} unit={form.currency} required={false} />
            <TextField label="مصدر الفرصة" value={form.source} onChange={set('source')} />
            <DateField label="تاريخ الفرصة" value={form.opp_date} onChange={set('opp_date')} />
            <DateField label="تاريخ الإغلاق المتوقع" value={form.expected_close_date} onChange={set('expected_close_date')} />
            <TextField label="المسؤول" value={form.responsible} onChange={set('responsible')} />
            <NumberField label="احتمالية الفوز %" value={form.win_probability} onChange={set('win_probability')} min={0} required={false} />
          </FieldGroup>
          <TextAreaField label="ملاحظات" value={form.notes} onChange={set('notes')} />
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="text-sm font-medium px-4 py-2 rounded-md border border-line text-ink hover:bg-line/50">إلغاء</button>
            <button type="submit" disabled={saving} className="text-sm font-medium px-4 py-2 rounded-md bg-navy text-white hover:bg-navy-600 disabled:opacity-50">{saving ? 'جارٍ الحفظ...' : 'حفظ'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
