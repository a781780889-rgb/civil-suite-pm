'use client';
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { FieldGroup, TextField, SelectField, NumberField } from '@/components/ui/Field.jsx';
import { DateField, TextAreaField } from '@/components/pm/PmField.jsx';
import { createEquipment, updateEquipment, listCategories } from '@/lib/equipmentApi.js';

const EMPTY = {
  equipment_code: '', name: '', category_key: '', manufacturer: '', model: '', manufacture_year: '',
  serial_number: '', chassis_number: '', engine_number: '', plate_number: '', color: '', weight_kg: '',
  capacity_value: '', capacity_unit: '', operating_power: '', tank_capacity_l: '', fuel_type: 'diesel',
  rated_consumption_l_per_hour: '', ownership_type: 'owned', current_location: '', responsible_person: '',
  purchase_date: '', purchase_price: '', useful_life_years: '', salvage_value: '',
  warranty_expiry: '', insurance_provider: '', insurance_policy_no: '', insurance_expiry: '', notes: '',
};

const FUEL_TYPES = [{ value: 'diesel', label: 'ديزل' }, { value: 'gasoline', label: 'بنزين' }, { value: 'electric', label: 'كهرباء' }, { value: 'none', label: 'بلا (يدوي)' }];
const OWNERSHIP_TYPES = [{ value: 'owned', label: 'مملوكة' }, { value: 'rented', label: 'مؤجَّرة' }];

export default function EquipmentFormModal({ open, onClose, onSaved, equipment }) {
  const [form, setForm] = useState(EMPTY);
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setForm(equipment ? { ...EMPTY, ...equipment } : EMPTY);
      setError(null);
      listCategories().then((res) => setCategories(res.rows || [])).catch(() => setCategories([]));
    }
  }, [open, equipment]);

  function set(field) { return (v) => setForm((f) => ({ ...f, [field]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      if (equipment) await updateEquipment(equipment.id, form);
      else await createEquipment(form);
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const categoryOptions = categories.map((c) => ({ value: c.key, label: `${c.name_ar} (${c.group_label_ar})` }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-navy-900/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line sticky top-0 bg-white z-10">
          <h2 className="font-bold text-ink">{equipment ? `تعديل بيانات: ${equipment.name}` : 'معدة جديدة'}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-line text-ink-soft"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="text-sm text-fail bg-fail/10 rounded-md px-3 py-2">{error}</div>}

          <FieldGroup title="البيانات الأساسية" cols={2}>
            <TextField label="اسم المعدة" value={form.name} onChange={set('name')} required />
            <TextField label="رقم المعدة" value={form.equipment_code} onChange={set('equipment_code')} placeholder="يُولَّد تلقائياً إن تُرك فارغاً" />
            <SelectField label="التصنيف" value={form.category_key} onChange={set('category_key')} options={categoryOptions} required />
            <SelectField label="الملكية" value={form.ownership_type} onChange={set('ownership_type')} options={OWNERSHIP_TYPES} />
            <TextField label="الشركة المصنعة" value={form.manufacturer} onChange={set('manufacturer')} />
            <TextField label="الموديل" value={form.model} onChange={set('model')} />
            <NumberField label="سنة الصنع" value={form.manufacture_year} onChange={set('manufacture_year')} required={false} />
            <TextField label="اللون" value={form.color} onChange={set('color')} />
          </FieldGroup>

          <FieldGroup title="البيانات الفنية" cols={2}>
            <TextField label="الرقم التسلسلي" value={form.serial_number} onChange={set('serial_number')} />
            <TextField label="رقم الهيكل" value={form.chassis_number} onChange={set('chassis_number')} />
            <TextField label="رقم المحرك" value={form.engine_number} onChange={set('engine_number')} />
            <TextField label="رقم اللوحة" value={form.plate_number} onChange={set('plate_number')} />
            <NumberField label="الوزن (كجم)" value={form.weight_kg} onChange={set('weight_kg')} required={false} />
            <NumberField label="الحمولة/السعة" value={form.capacity_value} onChange={set('capacity_value')} required={false} />
            <TextField label="وحدة السعة" value={form.capacity_unit} onChange={set('capacity_unit')} placeholder="طن، م³..." />
            <TextField label="القدرة التشغيلية" value={form.operating_power} onChange={set('operating_power')} placeholder="حصان، كيلوواط..." />
            <NumberField label="سعة الخزان (لتر)" value={form.tank_capacity_l} onChange={set('tank_capacity_l')} required={false} />
            <SelectField label="نوع الوقود" value={form.fuel_type} onChange={set('fuel_type')} options={FUEL_TYPES} />
            <NumberField label="معدل الاستهلاك المرجعي (لتر/ساعة)" value={form.rated_consumption_l_per_hour} onChange={set('rated_consumption_l_per_hour')} required={false} />
          </FieldGroup>

          <FieldGroup title="الموقع والمسؤولية" cols={2}>
            <TextField label="الموقع الحالي" value={form.current_location} onChange={set('current_location')} />
            <TextField label="المسؤول عنها" value={form.responsible_person} onChange={set('responsible_person')} />
          </FieldGroup>

          <FieldGroup title="الشراء والإهلاك" cols={2}>
            <DateField label="تاريخ الشراء" value={form.purchase_date} onChange={set('purchase_date')} />
            <NumberField label="سعر الشراء" value={form.purchase_price} onChange={set('purchase_price')} required={false} />
            <NumberField label="العمر الافتراضي (سنوات)" value={form.useful_life_years} onChange={set('useful_life_years')} required={false} />
            <NumberField label="قيمة الخردة المتبقية" value={form.salvage_value} onChange={set('salvage_value')} required={false} />
          </FieldGroup>

          <FieldGroup title="الضمان والتأمين" cols={2}>
            <DateField label="انتهاء الضمان" value={form.warranty_expiry} onChange={set('warranty_expiry')} />
            <TextField label="شركة التأمين" value={form.insurance_provider} onChange={set('insurance_provider')} />
            <TextField label="رقم بوليصة التأمين" value={form.insurance_policy_no} onChange={set('insurance_policy_no')} />
            <DateField label="انتهاء التأمين" value={form.insurance_expiry} onChange={set('insurance_expiry')} />
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
