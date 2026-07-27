'use client';
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { FieldGroup, TextField, SelectField } from '@/components/ui/Field.jsx';
import { TextAreaField } from '@/components/pm/PmField.jsx';
import { createPartner, updatePartner } from '@/lib/businessApi.js';

const EMPTY = { partner_code: '', partner_type: 'contractor', company_name: '', contact_person: '', phone: '', email: '', address: '', specialty: '', materials_services: '', insurance_info: '', certifications: '', status: 'active', notes: '' };

export default function PartnerFormModal({ open, onClose, onSaved, partner, defaultType }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { if (open) { setForm(partner ? { ...EMPTY, ...partner } : { ...EMPTY, partner_type: defaultType || 'contractor' }); setError(null); } }, [open, partner, defaultType]);

  function set(field) { return (v) => setForm((f) => ({ ...f, [field]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      if (partner) await updatePartner(partner.id, form);
      else await createPartner(form);
      onSaved?.();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  if (!open) return null;
  const isSupplier = form.partner_type === 'supplier';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-navy-900/40" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line sticky top-0 bg-white">
          <h2 className="font-bold text-ink">{partner ? 'تعديل بيانات الشريك' : (isSupplier ? 'مورد جديد' : 'مقاول جديد')}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-line text-ink-soft"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="text-sm text-fail bg-fail/10 rounded-md px-3 py-2">{error}</div>}
          <FieldGroup cols={2}>
            <SelectField label="النوع" value={form.partner_type} onChange={set('partner_type')} options={[{ value: 'contractor', label: 'مقاول' }, { value: 'supplier', label: 'مورد' }]} />
            <TextField label="رقم الشريك" value={form.partner_code} onChange={set('partner_code')} />
            <TextField label="اسم الشركة" value={form.company_name} onChange={set('company_name')} required />
            <SelectField label="الحالة" value={form.status} onChange={set('status')} options={[{ value: 'active', label: 'نشط' }, { value: 'under_review', label: 'قيد المراجعة' }, { value: 'inactive', label: 'غير نشط' }, { value: 'blacklisted', label: 'محظور' }]} />
          </FieldGroup>
          <FieldGroup title="بيانات التواصل" cols={2}>
            <TextField label="جهة الاتصال" value={form.contact_person} onChange={set('contact_person')} />
            <TextField label="الهاتف" value={form.phone} onChange={set('phone')} />
            <TextField label="البريد الإلكتروني" value={form.email} onChange={set('email')} />
            <TextField label="العنوان" value={form.address} onChange={set('address')} />
          </FieldGroup>
          {isSupplier ? (
            <TextAreaField label="المواد/الخدمات المقدَّمة" value={form.materials_services} onChange={set('materials_services')} />
          ) : (
            <TextField label="التخصص" value={form.specialty} onChange={set('specialty')} />
          )}
          <TextAreaField label="التأمينات" value={form.insurance_info} onChange={set('insurance_info')} />
          <TextAreaField label="شهادات الاعتماد" value={form.certifications} onChange={set('certifications')} />
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
