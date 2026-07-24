'use client';

import { useEffect, useState } from 'react';
import { NumberField, SelectField, FieldGroup } from './ui/Field.jsx';
import { fetchPriceLists } from '@/lib/api.js';

export default function PriceListPanel({ value, onChange }) {
  const [savedLists, setSavedLists] = useState([]);
  const [mode, setMode] = useState('custom'); // custom | saved

  useEffect(() => {
    fetchPriceLists().then((res) => {
      if (res.success) setSavedLists(res.priceLists);
    });
  }, []);

  function set(key, val) {
    onChange({ ...value, [key]: val });
  }

  function applySaved(id) {
    const list = savedLists.find((l) => String(l.id) === String(id));
    if (list) onChange({ ...value, ...list });
  }

  return (
    <div className="space-y-3">
      <FieldGroup cols={2}>
        <NumberField label="نسبة الهدر" unit="%" value={value.wastePct} onChange={(v) => set('wastePct', v)} />
        {savedLists.length > 0 && (
          <SelectField
            label="استخدام قائمة أسعار محفوظة"
            value=""
            onChange={applySaved}
            options={[{ value: '', label: '— اختر قائمة —' }, ...savedLists.map((l) => ({ value: l.id, label: l.name }))]}
          />
        )}
      </FieldGroup>
      <FieldGroup title="بنود التكلفة (ريال/طن)" cols={2}>
        <NumberField label="سعر طن الحديد" unit="ريال" value={value.steel_price_per_ton} onChange={(v) => set('steel_price_per_ton', v)} required={false} />
        <NumberField label="سعر القص" unit="ريال" value={value.cutting_price_per_ton} onChange={(v) => set('cutting_price_per_ton', v)} required={false} />
        <NumberField label="سعر التشكيل/الثني" unit="ريال" value={value.bending_price_per_ton} onChange={(v) => set('bending_price_per_ton', v)} required={false} />
        <NumberField label="سعر التركيب" unit="ريال" value={value.installation_price_per_ton} onChange={(v) => set('installation_price_per_ton', v)} required={false} />
        <NumberField label="سعر النقل" unit="ريال" value={value.transport_price_per_ton} onChange={(v) => set('transport_price_per_ton', v)} required={false} />
      </FieldGroup>
      <FieldGroup cols={2}>
        <NumberField label="الضريبة" unit="%" value={value.tax_pct} onChange={(v) => set('tax_pct', v)} required={false} />
        <NumberField label="الخصم" unit="%" value={value.discount_pct} onChange={(v) => set('discount_pct', v)} required={false} />
      </FieldGroup>
    </div>
  );
}

export function defaultPriceState() {
  return {
    wastePct: 3,
    steel_price_per_ton: 0,
    cutting_price_per_ton: 0,
    bending_price_per_ton: 0,
    installation_price_per_ton: 0,
    transport_price_per_ton: 0,
    tax_pct: 15,
    discount_pct: 0,
  };
}
