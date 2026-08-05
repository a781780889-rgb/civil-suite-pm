'use client';
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { FieldGroup, TextField, SelectField } from '@/components/ui/Field.jsx';
import { DateField, TextAreaField } from '@/components/pm/PmField.jsx';
import { createOperator, updateOperator, listCategories } from '@/lib/equipmentApi.js';

const EMPTY = {
  name: '', employee_no: '', national_id: '', specialization: '', license_no: '', license_type: '',
  license_expiry: '', training_notes: '', allowed_categories: [], performance_notes: '', is_active: 1,
};

export default function OperatorFormModal({ open, onClose, onSaved, operator }) {
  const [form, setForm] = useState(EMPTY);
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setForm(operator ? { ...EMPTY, ...operator } : EMPTY);
      setError(null);
      listCategories().then((res) => setCategories(res.rows || [])).catch(() => setCategories([]));
    }
  }, [open, operator]);

  function set(field) { return (v) => setForm((f) => ({ ...f, [field]: v })); }
  function toggleCategory(key) {
    setForm((f) => ({ ...f, allowed_categories: f.allowed_categories.includes(key) ? f.allowed_categories.filter((k) => k !== key) : [...f.allowed_categories, key] }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      if (operator) await updateOperator(operator.id, form);
      else await createOperator(form);
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
          <h2 className="font-bold text-ink">{operator ? 'تعديل بيانات المشغل' : 'مشغل جديد'}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-line text-ink-soft"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="text-sm text-fail bg-fail/10 rounded-md px-3 py-2">{error}</div>}
          <FieldGroup title="البيانات الأساسية" cols={2}>
            <TextField label="الاسم" value={form.name} onChange={set('name')} required />
            <TextField label="رقم الموظف" value={form.employee_no} onChange={set('employee_no')} />
            <TextField label="التخصص" value={form.specialization} onChange={set('specialization')} />
            <SelectField label="الحالة" value={String(form.is_active)} onChange={(v) => set('is_active')(Number(v))} options={[{ value: '1', label: 'نشط' }, { value: '0', label: 'غير نشط' }]} />
          </FieldGroup>
          <FieldGroup title="الترخيص" cols={2}>
            <TextField label="رقم الرخصة" value={form.license_no} onChange={set('license_no')} />
            <TextField label="نوع الرخصة" value={form.license_type} onChange={set('license_type')} />
            <DateField label="تاريخ انتهاء الرخصة" value={form.license_expiry} onChange={set('license_expiry')} />
          </FieldGroup>
          <div>
            <span className="block text-xs font-medium text-ink-soft mb-1.5">التصنيفات المصرَّح بتشغيلها</span>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <button
                  type="button" key={c.key} onClick={() => toggleCategory(c.key)}
                  className={`text-xs px-2.5 py-1 rounded-full border ${form.allowed_categories.includes(c.key) ? 'bg-navy text-white border-navy' : 'border-line text-ink-soft hover:bg-line/50'}`}
                >
                  {c.name_ar}
                </button>
              ))}
            </div>
          </div>
          <TextAreaField label="ملاحظات التدريب" value={form.training_notes} onChange={set('training_notes')} rows={2} />
          <TextAreaField label="ملاحظات الأداء" value={form.performance_notes} onChange={set('performance_notes')} rows={2} />
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="text-sm font-medium px-4 py-2 rounded-md border border-line text-ink hover:bg-line/50">إلغاء</button>
            <button type="submit" disabled={saving} className="text-sm font-medium px-4 py-2 rounded-md bg-navy text-white hover:bg-navy-600 disabled:opacity-50">{saving ? 'جارٍ الحفظ...' : 'حفظ'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
