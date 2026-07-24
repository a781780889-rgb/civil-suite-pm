'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { NumberField, SelectField, TextField, FieldGroup } from '@/components/ui/Field.jsx';
import DynamicCategoryFields from '@/components/boq/DynamicCategoryFields.jsx';
import { previewBoqElementCalc, createBoqElementApi, updateBoqElementApi } from '@/lib/api.js';
import { TRADES } from '@/lib/boq/categoryRegistry.js';

const UNIT_LABEL = { m: 'م', m2: 'م²', m3: 'م³', kg: 'كغم', ea: 'عدد' };

export default function ElementFormModal({ categories, projectId, editingElement, onClose, onSaved }) {
  const isEdit = !!editingElement;
  const categoriesByTrade = useMemo(() => {
    const map = {};
    categories.forEach((c) => { (map[c.trade] = map[c.trade] || []).push(c); });
    return map;
  }, [categories]);

  const [trade, setTrade] = useState(editingElement ? categories.find((c) => c.key === editingElement.category_key)?.trade : Object.keys(categoriesByTrade)[0]);
  const [categoryKey, setCategoryKey] = useState(editingElement?.category_key || categoriesByTrade[trade]?.[0]?.key || '');
  const category = categories.find((c) => c.key === categoryKey);

  const [name, setName] = useState(editingElement?.name || '');
  const [locationNote, setLocationNote] = useState(editingElement?.location_note || '');
  const [dimensions, setDimensions] = useState(editingElement?.dimensions || {});
  const [prices, setPrices] = useState({
    unit_material_price: editingElement?.unit_material_price || 0,
    unit_labor_price: editingElement?.unit_labor_price || 0,
    unit_equipment_price: editingElement?.unit_equipment_price || 0,
    unit_transport_price: editingElement?.unit_transport_price || 0,
    tax_pct: editingElement?.tax_pct || 0,
    discount_pct: editingElement?.discount_pct || 0,
  });
  const [notes, setNotes] = useState(editingElement?.notes || '');

  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  useEffect(() => {
    if (!categoryKey) return;
    setPreviewLoading(true);
    setPreviewError('');
    const t = setTimeout(() => {
      previewBoqElementCalc({ category_key: categoryKey, dimensions, ...prices }).then((res) => {
        if (res.success) setPreview(res);
        else { setPreview(null); setPreviewError(res.errors?.[0] || 'تعذّر الحساب.'); }
        setPreviewLoading(false);
      });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryKey, JSON.stringify(dimensions), JSON.stringify(prices)]);

  const submit = async (allowDuplicate = false) => {
    setSaving(true);
    setSaveError('');
    setDuplicateWarning(null);
    const payload = { project_id: projectId || null, category_key: categoryKey, name, location_note: locationNote, dimensions, ...prices, notes, allowDuplicate };
    const res = isEdit ? await updateBoqElementApi(editingElement.id, payload) : await createBoqElementApi(payload);
    setSaving(false);
    if (res.success) { onSaved(); return; }
    if (res.duplicate) { setDuplicateWarning(res); return; }
    setSaveError(res.errors?.[0] || 'تعذّر الحفظ.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-sheet shadow-sheet w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-line sticky top-0 bg-white z-10">
          <h3 className="font-bold text-navy-700">{isEdit ? 'تعديل عنصر' : 'إضافة عنصر حصر كميات'}</h3>
          <button onClick={onClose} className="text-ink-soft hover:text-ink"><X size={20} /></button>
        </div>

        <div className="p-5 space-y-5">
          <FieldGroup title="الصنف" cols={2}>
            <SelectField
              label="التخصص"
              value={trade}
              onChange={(v) => { setTrade(v); setCategoryKey(categoriesByTrade[v]?.[0]?.key || ''); setDimensions({}); }}
              options={Object.keys(categoriesByTrade).map((t) => ({ value: t, label: TRADES[t]?.label_ar || t }))}
            />
            <SelectField
              label="الصنف"
              value={categoryKey}
              onChange={(v) => { setCategoryKey(v); setDimensions({}); }}
              options={(categoriesByTrade[trade] || []).map((c) => ({ value: c.key, label: c.name_ar }))}
            />
          </FieldGroup>

          <FieldGroup title="الوصف والموقع" cols={2}>
            <TextField label="اسم العنصر" value={name} onChange={setName} placeholder="مثال: قواعد المحور A1-A5" required />
            <TextField label="الموقع داخل المشروع" value={locationNote} onChange={setLocationNote} placeholder="مثال: الدور الأرضي" />
          </FieldGroup>

          {category && (
            <FieldGroup title={`أبعاد ${category.name_ar}`} cols={1}>
              <DynamicCategoryFields category={category} values={dimensions} onChange={(k, v) => setDimensions((d) => ({ ...d, [k]: v }))} projectId={projectId} />
            </FieldGroup>
          )}

          <FieldGroup title="الأسعار" cols={2}>
            <NumberField label="سعر وحدة المواد" unit="ريال" value={prices.unit_material_price} onChange={(v) => setPrices((p) => ({ ...p, unit_material_price: v }))} required={false} />
            <NumberField label="سعر وحدة العمالة" unit="ريال" value={prices.unit_labor_price} onChange={(v) => setPrices((p) => ({ ...p, unit_labor_price: v }))} required={false} />
            <NumberField label="سعر وحدة المعدات" unit="ريال" value={prices.unit_equipment_price} onChange={(v) => setPrices((p) => ({ ...p, unit_equipment_price: v }))} required={false} />
            <NumberField label="سعر وحدة النقل" unit="ريال" value={prices.unit_transport_price} onChange={(v) => setPrices((p) => ({ ...p, unit_transport_price: v }))} required={false} />
            <NumberField label="نسبة الخصم" unit="%" value={prices.discount_pct} onChange={(v) => setPrices((p) => ({ ...p, discount_pct: v }))} required={false} />
            <NumberField label="نسبة الضريبة" unit="%" value={prices.tax_pct} onChange={(v) => setPrices((p) => ({ ...p, tax_pct: v }))} required={false} />
          </FieldGroup>

          <div className="rounded-md bg-navy-50 border border-navy-200 p-4">
            {previewLoading && <div className="flex items-center gap-2 text-sm text-navy-600"><Loader2 size={15} className="animate-spin" /> جارٍ الحساب...</div>}
            {!previewLoading && previewError && <div className="text-sm text-rebar-700">{previewError}</div>}
            {!previewLoading && preview && (
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div><div className="text-xs text-ink-soft mb-0.5">الكمية شاملة الهدر</div><div className="font-mono font-bold text-navy-700" dir="ltr">{preview.quantity.quantityWithWaste} {UNIT_LABEL[preview.quantity.unit]}</div></div>
                <div><div className="text-xs text-ink-soft mb-0.5">نسبة الهدر</div><div className="font-mono font-bold text-navy-700" dir="ltr">{preview.quantity.wastePct}%</div></div>
                <div><div className="text-xs text-ink-soft mb-0.5">التكلفة الإجمالية</div><div className="font-mono font-bold text-navy-700" dir="ltr">{preview.cost.finalCost.toLocaleString('en-US')} ريال</div></div>
              </div>
            )}
          </div>

          {duplicateWarning && (
            <div className="rounded-md bg-amber-50 border border-amber-300 p-3 flex items-start gap-2 text-sm text-amber-800">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <div className="flex-1">
                <p>يوجد عنصر بنفس الاسم والصنف والموقع في هذا المشروع بالفعل.</p>
                <button onClick={() => submit(true)} className="mt-1.5 font-bold underline">إضافته كعنصر منفصل رغم ذلك</button>
              </div>
            </div>
          )}
          {saveError && <div className="text-sm text-rebar-700">{saveError}</div>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-line sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 text-sm text-ink-soft hover:text-ink">إلغاء</button>
          <button
            onClick={() => submit(false)}
            disabled={saving || !name.trim() || !categoryKey}
            className="px-5 py-2 text-sm font-bold rounded-md bg-navy-600 text-white hover:bg-navy-700 disabled:opacity-50"
          >
            {saving ? 'جارٍ الحفظ...' : isEdit ? 'حفظ التعديلات' : 'إضافة العنصر'}
          </button>
        </div>
      </div>
    </div>
  );
}
