'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Trash2, Pencil, ChevronRight, ChevronLeft, Link2 } from 'lucide-react';
import { fetchBoqElements, fetchBoqCategories, deleteBoqElementApi } from '@/lib/api.js';
import { TRADES } from '@/lib/boq/categoryRegistry.js';
import ProjectPicker, { useSelectedProject } from '@/components/boq/ProjectPicker.jsx';
import ElementFormModal from '@/components/boq/ElementFormModal.jsx';

const UNIT_LABEL = { m: 'م', m2: 'م²', m3: 'م³', kg: 'كغم', ea: 'عدد' };

export default function BoqElementsPage() {
  const { projects, projectId, select, addProject } = useSelectedProject();
  const [categories, setCategories] = useState([]);
  const [trade, setTrade] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ rows: [], total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingElement, setEditingElement] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => { fetchBoqCategories().then((res) => { if (res.success) setCategories(res.categories); }); }, []);

  const load = useCallback(() => {
    setLoading(true);
    fetchBoqElements({ project_id: projectId, trade, search, page, pageSize: 20 }).then((res) => {
      if (res.success) setData(res);
      setLoading(false);
    });
  }, [projectId, trade, search, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [projectId, trade, search]);

  const confirmDelete = async (id) => {
    await deleteBoqElementApi(id);
    setDeletingId(null);
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-700">عناصر حصر الكميات</h1>
          <p className="text-ink-soft text-sm mt-1">{data.total.toLocaleString('en-US')} عنصر</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ProjectPicker projects={projects} projectId={projectId} onSelect={select} onCreate={addProject} />
          <button
            onClick={() => { setEditingElement(null); setModalOpen(true); }}
            className="flex items-center gap-1.5 bg-navy-600 hover:bg-navy-700 text-white text-sm font-bold px-4 py-2 rounded-md"
          >
            <Plus size={16} /> إضافة عنصر
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو الموقع..."
            className="w-full rounded-md border border-line bg-white pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300"
          />
        </div>
        <select value={trade} onChange={(e) => setTrade(e.target.value)} className="text-sm border border-line rounded-md px-2.5 py-2 bg-white">
          <option value="">كل التخصصات</option>
          {Object.entries(TRADES).map(([key, t]) => <option key={key} value={key}>{t.label_ar}</option>)}
        </select>
      </div>

      <div className="rounded-sheet border border-line bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-concrete-50 text-ink-soft text-xs">
            <tr>
              <th className="text-right px-4 py-2.5 font-semibold">العنصر</th>
              <th className="text-right px-4 py-2.5 font-semibold">التخصص / الصنف</th>
              <th className="text-right px-4 py-2.5 font-semibold">الكمية شاملة الهدر</th>
              <th className="text-right px-4 py-2.5 font-semibold">التكلفة</th>
              <th className="px-4 py-2.5 w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading && <tr><td colSpan={5} className="text-center py-10 text-ink-soft text-sm">جارٍ التحميل...</td></tr>}
            {!loading && data.rows.length === 0 && (
              <tr><td colSpan={5} className="text-center py-10 text-ink-soft text-sm">لا توجد عناصر بعد — ابدأ بإضافة عنصر أو استيراد ملف.</td></tr>
            )}
            {!loading && data.rows.map((el) => (
              <tr key={el.id} className="hover:bg-concrete-50/60">
                <td className="px-4 py-3">
                  <div className="font-medium text-ink flex items-center gap-1.5">
                    {el.name}
                    {el.linked_calculation_id && <Link2 size={12} className="text-navy-500" title="مرتبط بحساب محفوظ" />}
                  </div>
                  {el.location_note && <div className="text-xs text-ink-soft mt-0.5">{el.location_note}</div>}
                </td>
                <td className="px-4 py-3 text-ink-soft">
                  <div className="text-xs">{TRADES[el.trade]?.label_ar}</div>
                  <div className="text-xs font-medium text-ink">{el.category_name_ar}</div>
                </td>
                <td className="px-4 py-3 font-mono tabular-figure" dir="ltr">{el.quantity_with_waste} {UNIT_LABEL[el.unit]}</td>
                <td className="px-4 py-3 font-mono tabular-figure" dir="ltr">{Number(el.total_cost).toLocaleString('en-US')} ريال</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => { setEditingElement(el); setModalOpen(true); }} className="p-1.5 text-navy-600 hover:bg-navy-50 rounded"><Pencil size={15} /></button>
                    {deletingId === el.id ? (
                      <button onClick={() => confirmDelete(el.id)} className="text-xs font-bold text-white bg-rebar-600 px-2 py-1 rounded">تأكيد الحذف</button>
                    ) : (
                      <button onClick={() => setDeletingId(el.id)} className="p-1.5 text-rebar-600 hover:bg-rebar-50 rounded"><Trash2 size={15} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="p-1.5 rounded-md border border-line disabled:opacity-40"><ChevronRight size={16} /></button>
          <span className="text-sm text-ink-soft">صفحة {page} من {data.totalPages}</span>
          <button disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)} className="p-1.5 rounded-md border border-line disabled:opacity-40"><ChevronLeft size={16} /></button>
        </div>
      )}

      {modalOpen && (
        <ElementFormModal
          categories={categories}
          projectId={projectId}
          editingElement={editingElement}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); load(); }}
        />
      )}
    </div>
  );
}
