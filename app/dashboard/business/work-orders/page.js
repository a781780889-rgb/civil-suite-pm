'use client';
import { useEffect, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import { EmptyState } from '@/components/pm/Shared.jsx';
import StatusBadge, { PriorityBadge } from '@/components/business/StatusBadge.jsx';
import WorkOrderFormModal from '@/components/business/WorkOrderFormModal.jsx';
import { listWorkOrders, setWorkOrderStatus, deleteWorkOrder } from '@/lib/businessApi.js';

const NEXT = { new: 'approved', approved: 'in_progress', in_progress: 'completed', completed: 'closed' };
const NEXT_LABEL = { new: 'اعتماد', approved: 'بدء التنفيذ', in_progress: 'إنهاء', completed: 'إغلاق' };

export default function WorkOrdersPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  async function load() {
    setLoading(true);
    try { setRows((await listWorkOrders({ search: search || undefined, pageSize: 60 })).rows); }
    finally { setLoading(false); }
  }
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [search]);

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink">أوامر العمل</h1>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-md bg-navy text-white hover:bg-navy-600"><Plus size={16} /> أمر عمل جديد</button>
      </div>

      <div className="relative">
        <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالنشاط أو الرقم..." className="w-full max-w-md rounded-md border border-line bg-white pr-9 pl-3 py-2 text-sm" />
      </div>

      {loading ? <div className="text-sm text-ink-soft py-8 text-center">جارٍ التحميل...</div> : rows.length === 0 ? (
        <EmptyState title="لا توجد أوامر عمل" message="" />
      ) : (
        <div className="bg-white border border-line rounded-lg divide-y divide-line">
          {rows.map((w) => (
            <div key={w.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2"><span className="text-sm font-medium text-ink">{w.activity}</span><PriorityBadge priority={w.priority} /></div>
                <div className="text-xs text-ink-soft mt-0.5">{w.partner_name || w.responsible || '—'}{w.due_date ? ` · حتى ${w.due_date}` : ''}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-mono text-ink">{w.cost?.toLocaleString('ar-SA')}</span>
                <StatusBadge status={w.status} />
                {NEXT[w.status] && <button onClick={async () => { await setWorkOrderStatus(w.id, NEXT[w.status]); load(); }} className="text-[11px] font-medium px-2 py-1 rounded bg-navy/10 text-navy">{NEXT_LABEL[w.status]}</button>}
                <button onClick={async () => { if (confirm('حذف أمر العمل؟')) { await deleteWorkOrder(w.id); load(); } }} className="text-ink-soft hover:text-fail p-1"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <WorkOrderFormModal open={showModal} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />
    </div>
  );
}
