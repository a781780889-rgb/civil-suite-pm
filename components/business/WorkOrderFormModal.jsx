'use client';
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { FieldGroup, TextField, SelectField, NumberField } from '@/components/ui/Field.jsx';
import { DateField, TextAreaField } from '@/components/pm/PmField.jsx';
import { createWorkOrder, updateWorkOrder, listPartners, listContracts } from '@/lib/businessApi.js';

const EMPTY = { wo_no: '', activity: '', description: '', responsible: '', issue_date: '', due_date: '', priority: 'medium', cost: '', contract_id: '', partner_id: '' };

export default function WorkOrderFormModal({ open, onClose, onSaved, workOrder }) {
  const [form, setForm] = useState(EMPTY);
  const [partners, setPartners] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setForm(workOrder ? { ...EMPTY, ...workOrder } : EMPTY);
    setError(null);
    Promise.all([listPartners({ pageSize: 300 }), listContracts({ pageSize: 300 })]).then(([p, k]) => { setPartners(p.rows); setContracts(k.rows); }).catch(() => {});
  }, [open, workOrder]);

  function set(field) { return (v) => setForm((f) => ({ ...f, [field]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      if (workOrder) await updateWorkOrder(workOrder.id, form);
      else await createWorkOrder(form);
      onSaved?.();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-navy-900/40" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line sticky top-0 bg-white">
          <h2 className="font-bold text-ink">{workOrder ? 'تعديل أمر العمل' : 'أمر عمل جديد'}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-line text-ink-soft"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="text-sm text-fail bg-fail/10 rounded-md px-3 py-2">{error}</div>}
          <FieldGroup cols={2}>
            <TextField label="النشاط" value={form.activity} onChange={set('activity')} required />
            <TextField label="رقم أمر العمل" value={form.wo_no} onChange={set('wo_no')} />
            <SelectField label="العقد المرتبط" value={form.contract_id} onChange={set('contract_id')} options={[{ value: '', label: 'بدون' }, ...contracts.map((k) => ({ value: k.id, label: k.title }))]} />
            <SelectField label="الشريك المسؤول" value={form.partner_id} onChange={set('partner_id')} options={[{ value: '', label: 'بدون' }, ...partners.map((p) => ({ value: p.id, label: p.company_name }))]} />
            <TextField label="المسؤول" value={form.responsible} onChange={set('responsible')} />
            <SelectField label="الأولوية" value={form.priority} onChange={set('priority')} options={[{ value: 'low', label: 'منخفضة' }, { value: 'medium', label: 'متوسطة' }, { value: 'high', label: 'عالية' }, { value: 'critical', label: 'حرجة' }]} />
            <DateField label="تاريخ الإصدار" value={form.issue_date} onChange={set('issue_date')} />
            <DateField label="تاريخ الاستحقاق" value={form.due_date} onChange={set('due_date')} />
            <NumberField label="التكلفة" value={form.cost} onChange={set('cost')} required={false} />
          </FieldGroup>
          <TextAreaField label="الوصف" value={form.description} onChange={set('description')} />
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="text-sm font-medium px-4 py-2 rounded-md border border-line text-ink hover:bg-line/50">إلغاء</button>
            <button type="submit" disabled={saving} className="text-sm font-medium px-4 py-2 rounded-md bg-navy text-white hover:bg-navy-600 disabled:opacity-50">{saving ? 'جارٍ الحفظ...' : 'حفظ'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
