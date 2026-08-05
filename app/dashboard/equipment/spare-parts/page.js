'use client';
import { useEffect, useState } from 'react';
import { Plus, AlertTriangle } from 'lucide-react';
import ActorBar from '@/components/pm/ActorBar.jsx';
import NotificationsBell from '@/components/equipment/NotificationsBell.jsx';
import SparePartFormModal from '@/components/equipment/SparePartFormModal.jsx';
import { listSpareParts } from '@/lib/equipmentApi.js';

export default function SparePartsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);

  async function load() {
    setLoading(true);
    const res = await listSpareParts({ search: search || undefined, low_stock_only: lowOnly, pageSize: 100 });
    setRows(res.rows || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [lowOnly]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(load, 350); return () => clearTimeout(t); }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">قطع الغيار</h1>
          <p className="text-xs text-ink-soft">{rows.length} قطعة</p>
        </div>
        <div className="flex items-center gap-2">
          <NotificationsBell />
          <ActorBar />
          <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-md bg-navy text-white hover:bg-navy-600">
            <Plus size={15} /> قطعة جديدة
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالاسم أو رقم القطعة..." className="flex-1 min-w-[200px] rounded-md border border-line px-3 py-2 text-sm bg-paper" />
        <label className="flex items-center gap-1.5 text-sm text-ink-soft">
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} /> منخفضة المخزون فقط
        </label>
      </div>

      <div className="rounded-lg border border-line overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-line/40 text-ink-soft text-xs">
            <tr>
              <th className="px-3 py-2 text-right font-medium">القطعة</th>
              <th className="px-3 py-2 text-right font-medium">الرقم</th>
              <th className="px-3 py-2 text-right font-medium">المورد</th>
              <th className="px-3 py-2 text-right font-medium">الكمية</th>
              <th className="px-3 py-2 text-right font-medium">الحد الأدنى</th>
              <th className="px-3 py-2 text-right font-medium">السعر</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-3 py-6 text-center text-ink-soft">جارِ التحميل...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-ink-soft">لا توجد قطع غيار مسجّلة</td></tr>}
            {rows.map((p) => {
              const low = p.quantity_on_hand <= p.min_stock;
              return (
                <tr key={p.id} onClick={() => { setEditing(p); setShowForm(true); }} className="border-t border-line hover:bg-line/20 cursor-pointer">
                  <td className="px-3 py-2 font-medium text-ink">{p.part_name}</td>
                  <td className="px-3 py-2 font-mono text-xs text-ink-soft">{p.part_number || '—'}</td>
                  <td className="px-3 py-2 text-ink-soft">{p.supplier || '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`flex items-center gap-1 font-mono ${low ? 'text-fail font-bold' : 'text-ink'}`}>
                      {low && <AlertTriangle size={12} />} {p.quantity_on_hand}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-ink-soft">{p.min_stock}</td>
                  <td className="px-3 py-2 font-mono text-ink-soft">{p.unit_price}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <SparePartFormModal open={showForm} onClose={() => setShowForm(false)} part={editing} onSaved={() => { setShowForm(false); load(); }} />
    </div>
  );
}
