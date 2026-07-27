'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Users, Star } from 'lucide-react';
import { EmptyState } from '@/components/pm/Shared.jsx';
import StatusBadge from '@/components/business/StatusBadge.jsx';
import ClientFormModal from '@/components/business/ClientFormModal.jsx';
import { listClients } from '@/lib/businessApi.js';

const TYPE_AR = { company: 'شركة', individual: 'فرد', government: 'جهة حكومية' };

export default function ClientsPage() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [showModal, setShowModal] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await listClients({ search: search || undefined, status: status || undefined, pageSize: 60 });
      setRows(res.rows);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [search, status]);

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">العملاء</h1>
          <p className="text-sm text-ink-soft mt-0.5">{total} عميل</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-md bg-navy text-white hover:bg-navy-600 transition-colors">
          <Plus size={16} /> عميل جديد
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم أو الرقم أو الهاتف..." className="w-full rounded-md border border-line bg-white pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-line bg-white px-3 py-2 text-sm">
          <option value="">كل الحالات</option>
          <option value="active">نشط</option>
          <option value="inactive">غير نشط</option>
          <option value="blacklisted">محظور</option>
        </select>
      </div>

      {loading ? (
        <div className="text-sm text-ink-soft py-8 text-center">جارٍ التحميل...</div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} title="لا يوجد عملاء" message="ابدأ بإضافة أول عميل لك." action={<button onClick={() => setShowModal(true)} className="text-sm font-medium text-navy hover:underline">+ عميل جديد</button>} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((c) => (
            <Link key={c.id} href={`/dashboard/business/clients/${c.id}`} className="block bg-white border border-line rounded-lg p-4 hover:shadow-md hover:border-navy-300 transition-all">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-ink truncate">{c.name}</div>
                  <div className="text-xs text-ink-soft mt-0.5">{TYPE_AR[c.client_type]}{c.client_code ? ` · ${c.client_code}` : ''}</div>
                </div>
                <StatusBadge status={c.status} />
              </div>
              <div className="mt-3 space-y-1 text-xs text-ink-soft">
                {c.phone && <div dir="ltr" className="text-left">{c.phone}</div>}
                {c.city && <div>{c.city}</div>}
              </div>
              {c.rating && (
                <div className="mt-2 flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={12} className={i < c.rating ? 'fill-warnclr text-warnclr' : 'text-line'} />)}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      <ClientFormModal open={showModal} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />
    </div>
  );
}
