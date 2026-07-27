'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, CalendarClock } from 'lucide-react';
import { EmptyState } from '@/components/pm/Shared.jsx';
import MeetingFormModal from '@/components/business/MeetingFormModal.jsx';
import { listMeetings } from '@/lib/businessApi.js';

export default function MeetingsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  async function load() {
    setLoading(true);
    try { setRows((await listMeetings({ pageSize: 60 })).rows); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink">الاجتماعات</h1>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-md bg-navy text-white hover:bg-navy-600"><Plus size={16} /> اجتماع جديد</button>
      </div>

      {loading ? <div className="text-sm text-ink-soft py-8 text-center">جارٍ التحميل...</div> : rows.length === 0 ? (
        <EmptyState icon={CalendarClock} title="لا توجد اجتماعات" message="" />
      ) : (
        <div className="bg-white border border-line rounded-lg divide-y divide-line">
          {rows.map((m) => (
            <Link key={m.id} href={`/dashboard/business/meetings/${m.id}`} className="flex items-center justify-between px-4 py-3.5 hover:bg-line/40">
              <div>
                <div className="text-sm font-medium text-ink">{m.title}</div>
                <div className="text-xs text-ink-soft mt-0.5">{m.client_name || '—'}{m.location ? ` · ${m.location}` : ''}</div>
              </div>
              <span className="text-xs text-ink-soft" dir="ltr">{m.meeting_date || '—'}</span>
            </Link>
          ))}
        </div>
      )}

      <MeetingFormModal open={showModal} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />
    </div>
  );
}
