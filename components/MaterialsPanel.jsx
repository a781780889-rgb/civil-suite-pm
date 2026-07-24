'use client';

import { useState } from 'react';
import { NumberField, SelectField, FieldGroup } from './ui/Field.jsx';

const GRADE_OPTIONS = [
  { value: 'C10', label: 'C10 - نظافة/غير إنشائي' },
  { value: 'C15', label: 'C15 - قواعد نظافة/ردم' },
  { value: 'C20', label: 'C20 - عناصر إنشائية خفيفة' },
  { value: 'C25', label: 'C25 - عناصر إنشائية عامة' },
  { value: 'C30', label: 'C30 - أعمدة/كمرات/قواعد رئيسية' },
  { value: 'C35', label: 'C35 - عناصر معرضة لبيئة قاسية' },
  { value: 'C40', label: 'C40 - خزانات/منشآت خاصة' },
];

const CEMENT_TYPE_OPTIONS = [
  { value: 'OPC', label: 'أسمنت بورتلاندي عادي (OPC)' },
  { value: 'SRC', label: 'أسمنت مقاوم للكبريتات (SRC)' },
  { value: 'PPC', label: 'أسمنت بوزولاني (PPC)' },
];

export default function MaterialsPanel({ value, onChange }) {
  const [customRatio, setCustomRatio] = useState(false);
  const v = value;

  function set(key, val) {
    onChange({ ...v, [key]: val });
  }
  function setRatio(idx, val) {
    const r = [...(v.customRatio || [1, 1.5, 3])];
    r[idx] = val || 0;
    onChange({ ...v, customRatio: r });
  }
  function setPrice(key, val) {
    onChange({ ...v, unitPrices: { ...v.unitPrices, [key]: val || 0 } });
  }

  return (
    <div className="space-y-4">
      <FieldGroup title="مواصفات الخلطة" cols={2}>
        <SelectField label="رتبة الخرسانة" value={v.grade} onChange={(val) => set('grade', val)} options={GRADE_OPTIONS} />
        <SelectField label="نوع الأسمنت" value={v.cementType} onChange={(val) => set('cementType', val)} options={CEMENT_TYPE_OPTIONS} />
        <NumberField label="نسبة الهدر" unit="%" value={v.wasteRatioPct} onChange={(val) => set('wasteRatioPct', val)} />
        <NumberField label="نسبة الماء/الأسمنت" value={v.wcRatio ?? ''} onChange={(val) => set('wcRatio', val)} placeholder="افتراضي حسب الرتبة" required={false} />
      </FieldGroup>

      <label className="flex items-center gap-2 text-xs text-ink-soft cursor-pointer select-none">
        <input type="checkbox" checked={customRatio} onChange={(e) => setCustomRatio(e.target.checked)} className="rounded border-line" />
        تخصيص نسبة الخلط يدوياً (أسمنت : رمل : بحص)
      </label>
      {customRatio && (
        <div className="grid grid-cols-3 gap-2">
          <NumberField label="أسمنت" value={(v.customRatio || [1, 1.5, 3])[0]} onChange={(val) => setRatio(0, val)} required={false} />
          <NumberField label="رمل" value={(v.customRatio || [1, 1.5, 3])[1]} onChange={(val) => setRatio(1, val)} required={false} />
          <NumberField label="بحص" value={(v.customRatio || [1, 1.5, 3])[2]} onChange={(val) => setRatio(2, val)} required={false} />
        </div>
      )}

      <FieldGroup title="سعة النقل والخلط" cols={2}>
        <NumberField label="سعة الخلاطة" unit="m³" value={v.mixerCapacityM3} onChange={(val) => set('mixerCapacityM3', val)} required={false} />
        <NumberField label="سعة خلاطة النقل" unit="m³" value={v.truckCapacityM3} onChange={(val) => set('truckCapacityM3', val)} required={false} />
      </FieldGroup>

      <FieldGroup title="الأسعار المحلية (اختياري - لحساب التكلفة)" cols={2}>
        <NumberField label="سعر كيس الأسمنت" unit="ريال" value={v.unitPrices?.cementBagPrice} onChange={(val) => setPrice('cementBagPrice', val)} required={false} />
        <NumberField label="سعر م³ الرمل" unit="ريال" value={v.unitPrices?.sandPricePerM3} onChange={(val) => setPrice('sandPricePerM3', val)} required={false} />
        <NumberField label="سعر م³ البحص" unit="ريال" value={v.unitPrices?.gravelPricePerM3} onChange={(val) => setPrice('gravelPricePerM3', val)} required={false} />
        <NumberField label="سعر م³ الماء" unit="ريال" value={v.unitPrices?.waterPricePerM3} onChange={(val) => setPrice('waterPricePerM3', val)} required={false} />
      </FieldGroup>
    </div>
  );
}

export function defaultMaterialsState() {
  return {
    grade: 'C25',
    wasteRatioPct: 5,
    cementType: 'OPC',
    wcRatio: null,
    customRatio: null,
    mixerCapacityM3: 0.5,
    truckCapacityM3: 7,
    unitPrices: { cementBagPrice: 0, sandPricePerM3: 0, gravelPricePerM3: 0, waterPricePerM3: 0 },
  };
}

export function toMaterialsPayload(state) {
  const payload = { ...state };
  if (!payload.customRatio) delete payload.customRatio;
  if (payload.wcRatio === '' || payload.wcRatio == null) delete payload.wcRatio;
  return payload;
}
