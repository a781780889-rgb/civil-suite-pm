'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { EmptyState } from '@/components/pm/Shared.jsx';
import StatusBadge from '@/components/business/StatusBadge.jsx';
import ContractFormModal from '@/components/business/ContractFormModal.jsx';
import { listContracts } from '@/lib/businessApi.js';

export default function ContractsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [showModal, setShowModal] = useState(false);

  async function load() {
    setLoading(true);
    try { setRows((await listContracts({ search: search || undefined, status: status || undefined, pageSize: 60 })).rows); }
    finally { setLoading(false); }
  }
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [search, status]);

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink">العقود</h1>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-md bg-navy text-white hover:bg-navy-600"><Plus size={16} /> عقد جديد</button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالعنوان أو الرقم..." className="w-full rounded-md border border-line bg-white pr-9 pl-3 py-2 text-sm" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-line bg-white px-3 py-2 text-sm">
          <option value="">كل الحالات</option>
          {['draft', 'under_review', 'pending_approval', 'active', 'completed', 'terminated', 'cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? <div className="text-sm text-ink-soft py-8 text-center">جارٍ التحميل...</div> : rows.length === 0 ? (
        <EmptyState title="لا توجد عقود" message="عقود يتم إنشاؤها يدوياً أو تحويلها من عرض سعر فائز." />
      ) : (
        <div className="bg-white border border-line rounded-lg divide-y divide-line">
          {rows.map((k) => (
            <Link key={k.id} href={`/dashboard/business/contracts/${k.id}`} className="flex items-center justify-between px-4 py-3.5 hover:bg-line/40">
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink truncate">{k.title}</div>
                <div className="text-xs text-ink-soft mt-0.5">{k.client_name}{k.contract_no ? ` · ${k.contract_no}` : ''}{k.end_date ? ` · حتى ${k.end_date}` : ''}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-mono text-ink">{k.current_value?.toLocaleString('ar-SA')}</span>
                <StatusBadge status={k.status} />
              </div>
            </Link>
          ))}
        </div>
      )}

      <ContractFormModal open={showModal} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />
    </div>
  );
}
