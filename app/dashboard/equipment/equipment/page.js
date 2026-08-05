'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, ArrowLeft } from 'lucide-react';
import ActorBar from '@/components/pm/ActorBar.jsx';
import NotificationsBell from '@/components/equipment/NotificationsBell.jsx';
import StatusBadge from '@/components/equipment/StatusBadge.jsx';
import EquipmentFormModal from '@/components/equipment/EquipmentFormModal.jsx';
import { EQUIPMENT_STATUS_OPTIONS } from '@/lib/equipmentConstants.js';
import { listEquipment, listCategoryGroups } from '@/lib/equipmentApi.js';

export default function EquipmentListPage() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [groupKey, setGroupKey] = useState('');
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    const res = await listEquipment({ page, pageSize: 20, search: search || undefined, status: status || undefined, group_key: groupKey || undefined });
    setRows(res.rows || []);
    setTotal(res.total || 0);
    setLoading(false);
  }

  useEffect(() => { listCategoryGroups().then((res) => setGroups(res.groups || [])); }, []);
  useEffect(() => { load(); }, [page, status, groupKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(() => { setPage(1); load(); }, 350); return () => clearTimeout(t); }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">سجل المعدات</h1>
          <p className="text-xs text-ink-soft">{total} معدة</p>
        </div>
        <div className="flex items-center gap-2">
          <NotificationsBell />
          <ActorBar />
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-md bg-navy text-white hover:bg-navy-600">
            <Plus size={15} /> معدة جديدة
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالاسم أو الرقم أو الرقم التسلسلي..." className="w-full rounded-md border border-line pr-9 pl-3 py-2 text-sm bg-paper" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-line px-3 py-2 text-sm bg-paper">
          <option value="">كل الحالات</option>
          {EQUIPMENT_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={groupKey} onChange={(e) => setGroupKey(e.target.value)} className="rounded-md border border-line px-3 py-2 text-sm bg-paper">
          <option value="">كل الأنواع</option>
          {groups.map((g) => <option key={g.key} value={g.key}>{g.label_ar}</option>)}
        </select>
      </div>

      <div className="rounded-lg border border-line overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-line/40 text-ink-soft text-xs">
            <tr>
              <th className="px-3 py-2 text-right font-medium">الرقم</th>
              <th className="px-3 py-2 text-right font-medium">الاسم</th>
              <th className="px-3 py-2 text-right font-medium">التصنيف</th>
              <th className="px-3 py-2 text-right font-medium">الحالة</th>
              <th className="px-3 py-2 text-right font-medium">المشروع الحالي</th>
              <th className="px-3 py-2 text-right font-medium">عداد الساعات</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="px-3 py-6 text-center text-ink-soft">جارِ التحميل...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-ink-soft">لا توجد معدات مطابقة</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line hover:bg-line/20">
                <td className="px-3 py-2 font-mono text-xs text-ink-soft">{r.equipment_code}</td>
                <td className="px-3 py-2 font-medium text-ink">{r.name}</td>
                <td className="px-3 py-2 text-ink-soft">{r.category_name || '—'}</td>
                <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                <td className="px-3 py-2 text-ink-soft">{r.project_name || '—'}</td>
                <td className="px-3 py-2 font-mono text-ink-soft">{r.current_hour_meter ?? 0}</td>
                <td className="px-3 py-2">
                  <Link href={`/dashboard/equipment/equipment/${r.id}`} className="flex items-center gap-1 text-xs text-navy hover:underline whitespace-nowrap">
                    فتح <ArrowLeft size={12} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-md border border-line disabled:opacity-40">السابق</button>
          <span className="text-ink-soft">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-md border border-line disabled:opacity-40">التالي</button>
        </div>
      )}

      <EquipmentFormModal open={showForm} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />
    </div>
  );
}
