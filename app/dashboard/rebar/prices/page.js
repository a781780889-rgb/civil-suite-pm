'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Star } from 'lucide-react';
import { fetchPriceLists, savePriceList, deletePriceListApi } from '@/lib/api.js';
import { NumberField, TextField, FieldGroup, ToggleField } from '@/components/ui/Field.jsx';
import { ResultSection } from '@/components/ui/Results.jsx';

const emptyForm = {
  name: '',
  steel_price_per_ton: 0,
  cutting_price_per_ton: 0,
  bending_price_per_ton: 0,
  installation_price_per_ton: 0,
  transport_price_per_ton: 0,
  tax_pct: 15,
  discount_pct: 0,
  is_default: false,
};

export default function PriceLibraryPage() {
  const [lists, setLists] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  function load() {
    fetchPriceLists().then((res) => {
      if (res.success) setLists(res.priceLists);
    });
  }
  useEffect(load, []);

  function set(key, val) {
    setForm((s) => ({ ...s, [key]: val }));
  }

  async function handleSave() {
    setSaving(true);
    await savePriceList(form);
    setForm(emptyForm);
    setSaving(false);
    load();
  }

  async function handleDelete(id) {
    if (!confirm('حذف قائمة الأسعار هذه؟')) return;
    await deletePriceListApi(id);
    load();
  }

  function edit(list) {
    setForm(list);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-navy-700">مكتبة الأسعار</h1>
        <p className="text-sm text-ink-soft mt-0.5">إدارة قوائم أسعار الحديد لاستخدامها في جميع حاسبات القسم الثاني</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <ResultSection title={form.id ? `تعديل: ${form.name}` : 'إضافة قائمة أسعار جديدة'}>
          <div className="space-y-3">
            <TextField label="اسم القائمة" value={form.name} onChange={(v) => set('name', v)} placeholder="مثال: أسعار مشروع الرياض 2026" required />
            <FieldGroup cols={2}>
              <NumberField label="سعر طن الحديد" unit="ريال" value={form.steel_price_per_ton} onChange={(v) => set('steel_price_per_ton', v)} required={false} />
              <NumberField label="سعر القص" unit="ريال/طن" value={form.cutting_price_per_ton} onChange={(v) => set('cutting_price_per_ton', v)} required={false} />
              <NumberField label="سعر التشكيل/الثني" unit="ريال/طن" value={form.bending_price_per_ton} onChange={(v) => set('bending_price_per_ton', v)} required={false} />
              <NumberField label="سعر التركيب" unit="ريال/طن" value={form.installation_price_per_ton} onChange={(v) => set('installation_price_per_ton', v)} required={false} />
              <NumberField label="سعر النقل" unit="ريال/طن" value={form.transport_price_per_ton} onChange={(v) => set('transport_price_per_ton', v)} required={false} />
              <NumberField label="الضريبة" unit="%" value={form.tax_pct} onChange={(v) => set('tax_pct', v)} required={false} />
              <NumberField label="الخصم" unit="%" value={form.discount_pct} onChange={(v) => set('discount_pct', v)} required={false} />
            </FieldGroup>
            <ToggleField label="اعتماد كقائمة افتراضية" checked={!!form.is_default} onChange={(v) => set('is_default', v)} />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving || !form.name}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-navy-700 hover:bg-navy-800 disabled:opacity-50 text-white text-sm font-bold px-4 py-2.5"
              >
                <Plus size={16} /> {form.id ? 'حفظ التعديلات' : 'إضافة القائمة'}
              </button>
              {form.id && (
                <button onClick={() => setForm(emptyForm)} className="rounded-md border border-line px-4 py-2.5 text-sm">
                  إلغاء
                </button>
              )}
            </div>
          </div>
        </ResultSection>

        <ResultSection title={`القوائم المحفوظة (${lists.length})`}>
          {lists.length === 0 && <p className="text-sm text-ink-soft py-4 text-center">لا توجد قوائم أسعار محفوظة بعد.</p>}
          <div className="space-y-2">
            {lists.map((l) => (
              <div key={l.id} className="rounded-md border border-line p-3 flex items-center justify-between gap-2">
                <button onClick={() => edit(l)} className="text-right flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {!!l.is_default && <Star size={13} className="text-rebar-500 fill-rebar-500 shrink-0" />}
                    <span className="font-semibold text-sm text-ink truncate">{l.name}</span>
                  </div>
                  <span className="text-xs text-ink-soft font-mono tabular-figure" dir="ltr">
                    {l.steel_price_per_ton} SAR/ton · tax {l.tax_pct}%
                  </span>
                </button>
                <button onClick={() => handleDelete(l.id)} className="p-1.5 text-fail hover:bg-fail-50 rounded-md shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </ResultSection>
      </div>
    </div>
  );
}
