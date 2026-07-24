'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, Save, X, Coins } from 'lucide-react';
import { fetchBoqPrices, saveBoqPriceApi, updateBoqPriceApi, deleteBoqPriceApi, fetchBoqCategories } from '@/lib/api.js';
import ProjectPicker, { useSelectedProject } from '@/components/boq/ProjectPicker.jsx';

const BLANK = { item_name: '', unit: 'm2', category_key: '', material_price: 0, labor_price: 0, equipment_price: 0, transport_price: 0, supplier: '', region: '' };
const UNITS = [{ value: 'm', label: 'م' }, { value: 'm2', label: 'م²' }, { value: 'm3', label: 'م³' }, { value: 'kg', label: 'كغم' }, { value: 'ea', label: 'عدد' }];

export default function BoqPricesPage() {
  const { projects, projectId, select, addProject } = useSelectedProject();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [creating, setCreating] = useState(false);

  const load = () => fetchBoqPrices(projectId).then((res) => { if (res.success) setItems(res.items); });
  useEffect(() => { load(); }, [projectId]);
  useEffect(() => { fetchBoqCategories().then((res) => { if (res.success) setCategories(res.categories); }); }, []);

  const startEdit = (item) => { setEditingId(item.id); setForm(item); setCreating(false); };
  const startCreate = () => { setForm({ ...BLANK, project_id: projectId || null }); setCreating(true); setEditingId(null); };
  const cancel = () => { setCreating(false); setEditingId(null); setForm(BLANK); };

  const save = async () => {
    if (!form.item_name.trim()) return;
    const res = editingId ? await updateBoqPriceApi(editingId, form) : await saveBoqPriceApi({ ...form, project_id: projectId || null });
    if (res.success) { cancel(); load(); }
  };

  const remove = async (id) => { await deleteBoqPriceApi(id); load(); };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-700">مكتبة أسعار حصر الكميات</h1>
          <p className="text-ink-soft text-sm mt-1">أسعار مرجعية للمواد والعمالة والمعدات والنقل، عامة أو خاصة بمشروع محدد</p>
        </div>
        <div className="flex items-center gap-2">
          <ProjectPicker projects={projects} projectId={projectId} onSelect={select} onCreate={addProject} />
          <button onClick={startCreate} className="flex items-center gap-1.5 bg-navy-600 hover:bg-navy-700 text-white text-sm font-bold px-4 py-2 rounded-md">
            <Plus size={16} /> بند سعر جديد
          </button>
        </div>
      </div>

      {(creating || editingId) && (
        <div className="rounded-sheet border border-navy-300 bg-navy-50 p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <input placeholder="اسم البند" value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} className="rounded-md border border-line px-3 py-2 text-sm col-span-2" />
            <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="rounded-md border border-line px-3 py-2 text-sm bg-white">
              {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
            <select value={form.category_key || ''} onChange={(e) => setForm({ ...form, category_key: e.target.value })} className="rounded-md border border-line px-3 py-2 text-sm bg-white">
              <option value="">بلا صنف محدد</option>
              {categories.map((c) => <option key={c.key} value={c.key}>{c.name_ar}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <NumInput label="سعر المواد" value={form.material_price} onChange={(v) => setForm({ ...form, material_price: v })} />
            <NumInput label="سعر العمالة" value={form.labor_price} onChange={(v) => setForm({ ...form, labor_price: v })} />
            <NumInput label="سعر المعدات" value={form.equipment_price} onChange={(v) => setForm({ ...form, equipment_price: v })} />
            <NumInput label="سعر النقل" value={form.transport_price} onChange={(v) => setForm({ ...form, transport_price: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="المورّد (اختياري)" value={form.supplier || ''} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className="rounded-md border border-line px-3 py-2 text-sm" />
            <input placeholder="المنطقة (اختياري)" value={form.region || ''} onChange={(e) => setForm({ ...form, region: e.target.value })} className="rounded-md border border-line px-3 py-2 text-sm" />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button onClick={cancel} className="flex items-center gap-1 text-sm text-ink-soft px-3 py-1.5"><X size={14} /> إلغاء</button>
            <button onClick={save} className="flex items-center gap-1 text-sm font-bold bg-navy-600 text-white px-4 py-1.5 rounded-md"><Save size={14} /> حفظ</button>
          </div>
        </div>
      )}

      <div className="rounded-sheet border border-line bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-concrete-50 text-ink-soft text-xs">
            <tr>
              <th className="text-right px-4 py-2.5 font-semibold">البند</th>
              <th className="text-right px-4 py-2.5 font-semibold">الوحدة</th>
              <th className="text-right px-4 py-2.5 font-semibold">مواد</th>
              <th className="text-right px-4 py-2.5 font-semibold">عمالة</th>
              <th className="text-right px-4 py-2.5 font-semibold">معدات</th>
              <th className="text-right px-4 py-2.5 font-semibold">نقل</th>
              <th className="px-4 py-2.5 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.length === 0 && (
              <tr><td colSpan={7} className="text-center py-10 text-ink-soft text-sm"><Coins className="mx-auto mb-2 text-concrete-300" size={24} />لا توجد بنود أسعار بعد</td></tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-concrete-50/60">
                <td className="px-4 py-3 font-medium text-ink">{item.item_name}{!item.project_id && <span className="mr-2 text-[10px] font-bold text-navy-500 bg-navy-50 px-1.5 py-0.5 rounded">عام</span>}</td>
                <td className="px-4 py-3 text-ink-soft">{item.unit}</td>
                <td className="px-4 py-3 font-mono tabular-figure" dir="ltr">{item.material_price}</td>
                <td className="px-4 py-3 font-mono tabular-figure" dir="ltr">{item.labor_price}</td>
                <td className="px-4 py-3 font-mono tabular-figure" dir="ltr">{item.equipment_price}</td>
                <td className="px-4 py-3 font-mono tabular-figure" dir="ltr">{item.transport_price}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => startEdit(item)} className="p-1.5 text-navy-600 hover:bg-navy-50 rounded"><Pencil size={14} /></button>
                    <button onClick={() => remove(item.id)} className="p-1.5 text-rebar-600 hover:bg-rebar-50 rounded"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NumInput({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="block text-xs text-ink-soft mb-1">{label}</span>
      <input type="number" step="any" value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full rounded-md border border-line px-3 py-2 text-sm font-mono" dir="ltr" />
    </label>
  );
}
