'use client';
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { FieldGroup, TextField, NumberField } from '@/components/ui/Field.jsx';
import { TextAreaField } from '@/components/pm/PmField.jsx';
import { createSparePart, updateSparePart } from '@/lib/equipmentApi.js';

const EMPTY = { part_name: '', part_number: '', manufacturer: '', supplier: '', unit_price: '', quantity_on_hand: '', min_stock: '', storage_location: '', notes: '' };

export default function SparePartFormModal({ open, onClose, onSaved, part }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { if (open) { setForm(part ? { ...EMPTY, ...part } : EMPTY); setError(null); } }, [open, part]);

  function set(field) { return (v) => setForm((f) => ({ ...f, [field]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      if (part) await updateSparePart(part.id, form);
      else await createSparePart(form);
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
          <h2 className="font-bold text-ink">{part ? 'تعديل قطعة الغيار' : 'قطعة غيار جديدة'}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-line text-ink-soft"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="text-sm text-fail bg-fail/10 rounded-md px-3 py-2">{error}</div>}
          <TextField label="اسم القطعة" value={form.part_name} onChange={set('part_name')} required />
          <FieldGroup cols={2}>
            <TextField label="رقم القطعة" value={form.part_number} onChange={set('part_number')} />
            <TextField label="الشركة المصنعة" value={form.manufacturer} onChange={set('manufacturer')} />
            <TextField label="المورد" value={form.supplier} onChange={set('supplier')} />
            <TextField label="موقع التخزين" value={form.storage_location} onChange={set('storage_location')} />
          </FieldGroup>
          <FieldGroup title="المخزون والسعر" cols={3}>
            <NumberField label="الكمية المتوفرة" value={form.quantity_on_hand} onChange={set('quantity_on_hand')} required={false} />
            <NumberField label="الحد الأدنى" value={form.min_stock} onChange={set('min_stock')} required={false} />
            <NumberField label="سعر الوحدة" value={form.unit_price} onChange={set('unit_price')} required={false} />
          </FieldGroup>
          <TextAreaField label="ملاحظات" value={form.notes} onChange={set('notes')} rows={2} />
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="text-sm font-medium px-4 py-2 rounded-md border border-line text-ink hover:bg-line/50">إلغاء</button>
            <button type="submit" disabled={saving} className="text-sm font-medium px-4 py-2 rounded-md bg-navy text-white hover:bg-navy-600 disabled:opacity-50">{saving ? 'جارٍ الحفظ...' : 'حفظ'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
