'use client';
import { useEffect, useState } from 'react';
import { Plus, AlertTriangle, Trash2 } from 'lucide-react';
import { EmptyState } from '@/components/pm/Shared.jsx';
import StatusBadge, { PriorityBadge } from '@/components/business/StatusBadge.jsx';
import CommitmentFormModal from '@/components/business/CommitmentFormModal.jsx';
import { listCommitments, deleteCommitment } from '@/lib/businessApi.js';

export default function CommitmentsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  async function load() {
    setLoading(true);
    try { setRows((await listCommitments({ status: status || undefined, pageSize: 100 })).rows); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [status]);

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink">الالتزامات</h1>
        <button onClick={() => { setEditing(null); setShowModal(true); }} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-md bg-navy text-white hover:bg-navy-600"><Plus size={16} /> التزام جديد</button>
      </div>

      <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-line bg-white px-3 py-2 text-sm">
        <option value="">كل الحالات</option>
        <option value="open">مفتوح</option><option value="overdue">متأخر</option><option value="done">مُنجز</option><option value="cancelled">ملغي</option>
      </select>

      {loading ? <div className="text-sm text-ink-soft py-8 text-center">جارٍ التحميل...</div> : rows.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="لا توجد التزامات" message="" />
      ) : (
        <div className="bg-white border border-line rounded-lg divide-y divide-line">
          {rows.map((c) => (
            <div key={c.id} onClick={() => { setEditing(c); setShowModal(true); }} className="flex items-center justify-between gap-2 px-4 py-3.5 hover:bg-line/40 cursor-pointer">
              <div className="flex items-center gap-2 min-w-0">
                <PriorityBadge priority={c.priority} />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink truncate">{c.title}</div>
                  <div className="text-xs text-ink-soft mt-0.5">{c.responsible || '—'}{c.due_date ? ` · حتى ${c.due_date}` : ''}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge status={c.status} />
                <button onClick={async (e) => { e.stopPropagation(); if (confirm('حذف الالتزام؟')) { await deleteCommitment(c.id); load(); } }} className="text-ink-soft hover:text-fail p-1"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CommitmentFormModal open={showModal} commitment={editing} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />
    </div>
  );
}
