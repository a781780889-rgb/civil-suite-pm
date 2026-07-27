'use client';
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { FieldGroup, TextField, SelectField, NumberField } from '@/components/ui/Field.jsx';
import { DateField, TextAreaField } from '@/components/pm/PmField.jsx';
import { createContract, updateContract, listClients } from '@/lib/businessApi.js';

const EMPTY = { contract_no: '', client_id: '', title: '', scope_of_work: '', original_value: '', start_date: '', end_date: '', duration_days: '', payment_terms: '', warranties: '', obligations: '', special_terms: '' };

export default function ContractFormModal({ open, onClose, onSaved, contract, defaultClientId }) {
  const [form, setForm] = useState(EMPTY);
  const [clients, setClients] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setForm(contract ? { ...EMPTY, ...contract, original_value: contract.original_value } : { ...EMPTY, client_id: defaultClientId || '' });
    setError(null);
    listClients({ pageSize: 500 }).then((r) => setClients(r.rows)).catch(() => {});
  }, [open, contract, defaultClientId]);

  function set(field) { return (v) => setForm((f) => ({ ...f, [field]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      if (contract) await updateContract(contract.id, form);
      else await createContract(form);
      onSaved?.();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-navy-900/40" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line sticky top-0 bg-white">
          <h2 className="font-bold text-ink">{contract ? 'تعديل بيانات العقد' : 'عقد جديد'}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-line text-ink-soft"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="text-sm text-fail bg-fail/10 rounded-md px-3 py-2">{error}</div>}
          <FieldGroup cols={2}>
            <TextField label="عنوان العقد" value={form.title} onChange={set('title')} required />
            <TextField label="رقم العقد" value={form.contract_no} onChange={set('contract_no')} />
            <SelectField label="العميل" value={form.client_id} onChange={set('client_id')} options={[{ value: '', label: 'اختر عميلاً...' }, ...clients.map((c) => ({ value: c.id, label: c.name }))]} />
            {!contract && <NumberField label="القيمة الأصلية" value={form.original_value} onChange={set('original_value')} required={false} />}
          </FieldGroup>
          <FieldGroup title="المدة والدفع" cols={2}>
            <DateField label="تاريخ البداية" value={form.start_date} onChange={set('start_date')} />
            <DateField label="تاريخ النهاية" value={form.end_date} onChange={set('end_date')} />
            <NumberField label="المدة (أيام)" value={form.duration_days} onChange={set('duration_days')} required={false} />
            <TextField label="شروط الدفع" value={form.payment_terms} onChange={set('payment_terms')} />
          </FieldGroup>
          <TextAreaField label="نطاق العمل" value={form.scope_of_work} onChange={set('scope_of_work')} />
          <TextAreaField label="الضمانات" value={form.warranties} onChange={set('warranties')} />
          <TextAreaField label="الالتزامات" value={form.obligations} onChange={set('obligations')} />
          <TextAreaField label="بنود خاصة" value={form.special_terms} onChange={set('special_terms')} />
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="text-sm font-medium px-4 py-2 rounded-md border border-line text-ink hover:bg-line/50">إلغاء</button>
            <button type="submit" disabled={saving} className="text-sm font-medium px-4 py-2 rounded-md bg-navy text-white hover:bg-navy-600 disabled:opacity-50">{saving ? 'جارٍ الحفظ...' : 'حفظ'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
