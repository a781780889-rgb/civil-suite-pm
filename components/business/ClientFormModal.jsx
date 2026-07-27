'use client';
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { FieldGroup, TextField, SelectField, NumberField } from '@/components/ui/Field.jsx';
import { TextAreaField } from '@/components/pm/PmField.jsx';
import { createClient, updateClient } from '@/lib/businessApi.js';

const EMPTY = {
  client_code: '', name: '', client_type: 'company', status: 'active', phone: '', email: '', website: '',
  address: '', city: '', country: '', contact_person: '', contact_title: '', rating: '', source: '', notes: '',
};

export default function ClientFormModal({ open, onClose, onSaved, client }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { if (open) { setForm(client ? { ...EMPTY, ...client } : EMPTY); setError(null); } }, [open, client]);

  function set(field) { return (v) => setForm((f) => ({ ...f, [field]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      if (client) await updateClient(client.id, form);
      else await createClient(form);
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
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line sticky top-0 bg-white">
          <h2 className="font-bold text-ink">{client ? 'تعديل بيانات العميل' : 'عميل جديد'}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-line text-ink-soft"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="text-sm text-fail bg-fail/10 rounded-md px-3 py-2">{error}</div>}
          <FieldGroup title="البيانات الأساسية" cols={2}>
            <TextField label="اسم العميل" value={form.name} onChange={set('name')} required />
            <TextField label="رقم العميل" value={form.client_code} onChange={set('client_code')} />
            <SelectField label="نوع العميل" value={form.client_type} onChange={set('client_type')} options={[{ value: 'company', label: 'شركة' }, { value: 'individual', label: 'فرد' }, { value: 'government', label: 'جهة حكومية' }]} />
            <SelectField label="الحالة" value={form.status} onChange={set('status')} options={[{ value: 'active', label: 'نشط' }, { value: 'inactive', label: 'غير نشط' }, { value: 'blacklisted', label: 'محظور' }]} />
          </FieldGroup>
          <FieldGroup title="بيانات التواصل" cols={2}>
            <TextField label="الهاتف" value={form.phone} onChange={set('phone')} />
            <TextField label="البريد الإلكتروني" value={form.email} onChange={set('email')} />
            <TextField label="الموقع الإلكتروني" value={form.website} onChange={set('website')} />
            <TextField label="المدينة" value={form.city} onChange={set('city')} />
            <TextField label="الدولة" value={form.country} onChange={set('country')} />
            <TextField label="العنوان" value={form.address} onChange={set('address')} />
          </FieldGroup>
          <FieldGroup title="جهة الاتصال الرئيسية" cols={2}>
            <TextField label="الاسم" value={form.contact_person} onChange={set('contact_person')} />
            <TextField label="المسمى الوظيفي" value={form.contact_title} onChange={set('contact_title')} />
          </FieldGroup>
          <FieldGroup title="تقييم ومصدر" cols={2}>
            <NumberField label="التقييم (1-5)" value={form.rating} onChange={set('rating')} min={1} required={false} />
            <TextField label="مصدر العميل" value={form.source} onChange={set('source')} />
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
