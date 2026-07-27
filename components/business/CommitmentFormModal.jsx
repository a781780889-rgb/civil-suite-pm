'use client';
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { FieldGroup, TextField, SelectField } from '@/components/ui/Field.jsx';
import { DateField, TextAreaField } from '@/components/pm/PmField.jsx';
import { createCommitment, updateCommitment } from '@/lib/businessApi.js';

const EMPTY = { title: '', responsible: '', due_date: '', priority: 'medium', required_action: '' };

export default function CommitmentFormModal({ open, onClose, onSaved, commitment }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { if (open) { setForm(commitment ? { ...EMPTY, ...commitment } : EMPTY); setError(null); } }, [open, commitment]);

  function set(field) { return (v) => setForm((f) => ({ ...f, [field]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      if (commitment) await updateCommitment(commitment.id, form);
      else await createCommitment(form);
      onSaved?.();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-navy-900/40" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line sticky top-0 bg-white">
          <h2 className="font-bold text-ink">{commitment ? 'تعديل الالتزام' : 'التزام جديد'}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-line text-ink-soft"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="text-sm text-fail bg-fail/10 rounded-md px-3 py-2">{error}</div>}
          <TextField label="اسم الالتزام" value={form.title} onChange={set('title')} required />
          <FieldGroup cols={2}>
            <TextField label="الطرف المسؤول" value={form.responsible} onChange={set('responsible')} />
            <DateField label="تاريخ الاستحقاق" value={form.due_date} onChange={set('due_date')} />
            <SelectField label="الأولوية" value={form.priority} onChange={set('priority')} options={[{ value: 'low', label: 'منخفضة' }, { value: 'medium', label: 'متوسطة' }, { value: 'high', label: 'عالية' }, { value: 'critical', label: 'حرجة' }]} />
            {commitment && <SelectField label="الحالة" value={form.status} onChange={set('status')} options={[{ value: 'open', label: 'مفتوح' }, { value: 'done', label: 'مُنجز' }, { value: 'cancelled', label: 'ملغي' }]} />}
          </FieldGroup>
          <TextAreaField label="الإجراء المطلوب" value={form.required_action} onChange={set('required_action')} />
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="text-sm font-medium px-4 py-2 rounded-md border border-line text-ink hover:bg-line/50">إلغاء</button>
            <button type="submit" disabled={saving} className="text-sm font-medium px-4 py-2 rounded-md bg-navy text-white hover:bg-navy-600 disabled:opacity-50">{saving ? 'جارٍ الحفظ...' : 'حفظ'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
