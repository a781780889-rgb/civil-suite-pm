'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import ActorBar from '@/components/pm/ActorBar.jsx';
import NotificationsBell from '@/components/equipment/NotificationsBell.jsx';
import StatusBadge from '@/components/equipment/StatusBadge.jsx';
import { listReservations } from '@/lib/equipmentApi.js';

export default function ReservationsOverviewPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  async function load() {
    setLoading(true);
    const res = await listReservations({ status: statusFilter || undefined, pageSize: 100 });
    setRows(res.rows || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">جدول حجوزات المعدات</h1>
          <p className="text-xs text-ink-soft">لإنشاء حجز جديد، افتح المعدة المطلوبة ثم تبويب «الحجز والتخصيص»</p>
        </div>
        <div className="flex items-center gap-2"><NotificationsBell /><ActorBar /></div>
      </div>

      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-md border border-line px-3 py-2 text-sm bg-paper">
        <option value="">كل الحالات</option>
        <option value="pending">قيد الانتظار</option>
        <option value="confirmed">مؤكَّد</option>
        <option value="completed">مكتمل</option>
        <option value="cancelled">ملغي</option>
      </select>

      <div className="rounded-lg border border-line overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-line/40 text-ink-soft text-xs">
            <tr>
              <th className="px-3 py-2 text-right font-medium">المعدة</th>
              <th className="px-3 py-2 text-right font-medium">المشروع</th>
              <th className="px-3 py-2 text-right font-medium">من</th>
              <th className="px-3 py-2 text-right font-medium">إلى</th>
              <th className="px-3 py-2 text-right font-medium">الحالة</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-3 py-6 text-center text-ink-soft">جارِ التحميل...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-ink-soft">لا توجد حجوزات</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line hover:bg-line/20">
                <td className="px-3 py-2 font-medium text-ink">{r.equipment_name}</td>
                <td className="px-3 py-2 text-ink-soft">{r.project_name}</td>
                <td className="px-3 py-2 text-ink-soft">{r.start_date}</td>
                <td className="px-3 py-2 text-ink-soft">{r.end_date}</td>
                <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                <td className="px-3 py-2"><Link href={`/dashboard/equipment/equipment/${r.equipment_id}?tab=reservations`} className="text-xs text-navy hover:underline">فتح</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
