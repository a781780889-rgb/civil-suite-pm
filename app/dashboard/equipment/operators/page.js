'use client';
import { useEffect, useState } from 'react';
import { Plus, ShieldCheck, ShieldAlert } from 'lucide-react';
import ActorBar from '@/components/pm/ActorBar.jsx';
import NotificationsBell from '@/components/equipment/NotificationsBell.jsx';
import OperatorFormModal from '@/components/equipment/OperatorFormModal.jsx';
import { listOperators } from '@/lib/equipmentApi.js';

export default function OperatorsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true);
    const res = await listOperators({ search: search || undefined, pageSize: 100 });
    setRows(res.rows || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(load, 350); return () => clearTimeout(t); }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">مشغلو المعدات</h1>
          <p className="text-xs text-ink-soft">{rows.length} مشغل</p>
        </div>
        <div className="flex items-center gap-2">
          <NotificationsBell />
          <ActorBar />
          <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-md bg-navy text-white hover:bg-navy-600">
            <Plus size={15} /> مشغل جديد
          </button>
        </div>
      </div>

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالاسم أو رقم الرخصة..." className="w-full max-w-sm rounded-md border border-line px-3 py-2 text-sm bg-paper" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {loading && <p className="text-sm text-ink-soft">جارِ التحميل...</p>}
        {!loading && rows.length === 0 && <p className="text-sm text-ink-soft">لا يوجد مشغلون مسجّلون بعد</p>}
        {rows.map((o) => {
          const expired = o.license_expiry && o.license_expiry < today;
          return (
            <button key={o.id} onClick={() => { setEditing(o); setShowForm(true); }} className="text-right rounded-lg border border-line bg-white p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between">
                <span className="font-bold text-ink">{o.name}</span>
                {expired ? <ShieldAlert size={16} className="text-fail" /> : <ShieldCheck size={16} className="text-pass" />}
              </div>
              <p className="text-xs text-ink-soft mt-1">{o.specialization || '—'}</p>
              {o.license_no && <p className="text-xs text-ink-soft mt-1">رخصة {o.license_type}: {o.license_no} {o.license_expiry ? `(تنتهي ${o.license_expiry})` : ''}</p>}
              <p className="text-[11px] text-ink-soft mt-2">{o.allowed_categories?.length || 0} تصنيف مصرَّح به</p>
            </button>
          );
        })}
      </div>

      <OperatorFormModal open={showForm} onClose={() => setShowForm(false)} operator={editing} onSaved={() => { setShowForm(false); load(); }} />
    </div>
  );
}
