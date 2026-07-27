'use client';
import { useEffect, useState } from 'react';
import { Plus, Search, Mail, Trash2, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { EmptyState } from '@/components/pm/Shared.jsx';
import StatusBadge from '@/components/business/StatusBadge.jsx';
import CorrespondenceFormModal from '@/components/business/CorrespondenceFormModal.jsx';
import { listCorrespondence, deleteCorrespondence } from '@/lib/businessApi.js';

export default function CorrespondencePage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  async function load() {
    setLoading(true);
    try { setRows((await listCorrespondence({ search: search || undefined, direction: direction || undefined, pageSize: 60 })).rows); }
    finally { setLoading(false); }
  }
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [search, direction]);

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink">المراسلات</h1>
        <button onClick={() => { setEditing(null); setShowModal(true); }} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-md bg-navy text-white hover:bg-navy-600"><Plus size={16} /> مراسلة جديدة</button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالموضوع أو الرقم..." className="w-full rounded-md border border-line bg-white pr-9 pl-3 py-2 text-sm" />
        </div>
        <select value={direction} onChange={(e) => setDirection(e.target.value)} className="rounded-md border border-line bg-white px-3 py-2 text-sm">
          <option value="">كل الاتجاهات</option>
          <option value="outgoing">صادر</option><option value="incoming">وارد</option><option value="internal">داخلي</option><option value="email">بريد إلكتروني</option><option value="notice">إشعار</option>
        </select>
      </div>

      {loading ? <div className="text-sm text-ink-soft py-8 text-center">جارٍ التحميل...</div> : rows.length === 0 ? (
        <EmptyState icon={Mail} title="لا توجد مراسلات" message="" />
      ) : (
        <div className="bg-white border border-line rounded-lg divide-y divide-line">
          {rows.map((c) => (
            <div key={c.id} onClick={() => { setEditing(c); setShowModal(true); }} className="flex items-center justify-between gap-2 px-4 py-3.5 hover:bg-line/40 cursor-pointer">
              <div className="flex items-center gap-2 min-w-0">
                {c.direction === 'incoming' ? <ArrowDownLeft size={14} className="text-pass shrink-0" /> : <ArrowUpRight size={14} className="text-navy shrink-0" />}
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink truncate">{c.subject}</div>
                  <div className="text-xs text-ink-soft mt-0.5">{c.client_name || c.sender || '—'}{c.correspondence_date ? ` · ${c.correspondence_date}` : ''}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge status={c.status} />
                <button onClick={async (e) => { e.stopPropagation(); if (confirm('حذف المراسلة؟')) { await deleteCorrespondence(c.id); load(); } }} className="text-ink-soft hover:text-fail p-1"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CorrespondenceFormModal open={showModal} item={editing} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />
    </div>
  );
}
