'use client';
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { FieldGroup, TextField, SelectField, NumberField } from '@/components/ui/Field.jsx';
import { DateField, TextAreaField } from '@/components/pm/PmField.jsx';
import { createQuote, updateQuote, listClients, listOpportunities } from '@/lib/businessApi.js';

const EMPTY = { quote_no: '', client_id: '', opportunity_id: '', title: '', issue_date: '', validity_date: '', payment_terms: '', execution_duration_days: '', discount_pct: 0, tax_pct: 15, other_costs: 0, currency: 'SAR', notes: '' };

export default function QuoteFormModal({ open, onClose, onSaved, quote, defaultClientId, defaultOpportunityId }) {
  const [form, setForm] = useState(EMPTY);
  const [clients, setClients] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setForm(quote ? { ...EMPTY, ...quote } : { ...EMPTY, client_id: defaultClientId || '', opportunity_id: defaultOpportunityId || '' });
    setError(null);
    listClients({ pageSize: 500 }).then((r) => setClients(r.rows)).catch(() => {});
  }, [open, quote, defaultClientId, defaultOpportunityId]);

  useEffect(() => {
    if (!form.client_id) { setOpportunities([]); return; }
    listOpportunities({ client_id: form.client_id, pageSize: 200 }).then((r) => setOpportunities(r.rows)).catch(() => {});
  }, [form.client_id]);

  function set(field) { return (v) => setForm((f) => ({ ...f, [field]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      if (quote) await updateQuote(quote.id, form);
      else await createQuote(form);
      onSaved?.();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-navy-900/40" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line sticky top-0 bg-white">
          <h2 className="font-bold text-ink">{quote ? 'تعديل بيانات عرض السعر' : 'عرض سعر جديد'}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-line text-ink-soft"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="text-sm text-fail bg-fail/10 rounded-md px-3 py-2">{error}</div>}
          <FieldGroup cols={2}>
            <TextField label="عنوان عرض السعر" value={form.title} onChange={set('title')} required />
            <TextField label="رقم العرض" value={form.quote_no} onChange={set('quote_no')} />
            <SelectField label="العميل" value={form.client_id} onChange={set('client_id')} options={[{ value: '', label: 'اختر عميلاً...' }, ...clients.map((c) => ({ value: c.id, label: c.name }))]} />
            <SelectField label="الفرصة المرتبطة" value={form.opportunity_id} onChange={set('opportunity_id')} options={[{ value: '', label: 'بدون' }, ...opportunities.map((o) => ({ value: o.id, label: o.name }))]} />
          </FieldGroup>
          <FieldGroup title="الشروط" cols={2}>
            <DateField label="تاريخ الإصدار" value={form.issue_date} onChange={set('issue_date')} />
            <DateField label="صالح حتى" value={form.validity_date} onChange={set('validity_date')} />
            <TextField label="شروط الدفع" value={form.payment_terms} onChange={set('payment_terms')} />
            <NumberField label="مدة التنفيذ (أيام)" value={form.execution_duration_days} onChange={set('execution_duration_days')} required={false} />
          </FieldGroup>
          <FieldGroup title="الخصم والضريبة (على مستوى العرض)" cols={3}>
            <NumberField label="خصم" unit="%" value={form.discount_pct} onChange={set('discount_pct')} required={false} />
            <NumberField label="ضريبة" unit="%" value={form.tax_pct} onChange={set('tax_pct')} required={false} />
            <NumberField label="مصاريف أخرى" value={form.other_costs} onChange={set('other_costs')} required={false} />
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
