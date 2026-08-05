'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import ActorBar from '@/components/pm/ActorBar.jsx';
import NotificationsBell from '@/components/equipment/NotificationsBell.jsx';
import StatusBadge, { SeverityBadge } from '@/components/equipment/StatusBadge.jsx';
import { listBreakdowns } from '@/lib/equipmentApi.js';

export default function BreakdownsOverviewPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  async function load() {
    setLoading(true);
    const res = await listBreakdowns({ status: statusFilter || undefined, pageSize: 100 });
    setRows(res.rows || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">الأعطال عبر الأسطول</h1>
          <p className="text-xs text-ink-soft">لتسجيل عطل جديد، افتح المعدة المطلوبة ثم تبويب «الأعطال»</p>
        </div>
        <div className="flex items-center gap-2"><NotificationsBell /><ActorBar /></div>
      </div>

      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-md border border-line px-3 py-2 text-sm bg-paper">
        <option value="">كل الحالات</option>
        <option value="open">مفتوح</option>
        <option value="in_repair">قيد الإصلاح</option>
        <option value="resolved">تم الإصلاح</option>
      </select>

      <div className="rounded-lg border border-line overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-line/40 text-ink-soft text-xs">
            <tr>
              <th className="px-3 py-2 text-right font-medium">البلاغ</th>
              <th className="px-3 py-2 text-right font-medium">المعدة</th>
              <th className="px-3 py-2 text-right font-medium">التاريخ</th>
              <th className="px-3 py-2 text-right font-medium">الوصف</th>
              <th className="px-3 py-2 text-right font-medium">الخطورة</th>
              <th className="px-3 py-2 text-right font-medium">الحالة</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="px-3 py-6 text-center text-ink-soft">جارِ التحميل...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-ink-soft">لا توجد أعطال مسجّلة</td></tr>}
            {rows.map((b) => (
              <tr key={b.id} className="border-t border-line hover:bg-line/20">
                <td className="px-3 py-2 font-mono text-xs text-ink-soft">{b.report_no}</td>
                <td className="px-3 py-2 font-medium text-ink">{b.equipment_name}</td>
                <td className="px-3 py-2 text-ink-soft">{b.breakdown_date}</td>
                <td className="px-3 py-2 text-ink-soft truncate max-w-xs">{b.description}</td>
                <td className="px-3 py-2"><SeverityBadge severity={b.severity} /></td>
                <td className="px-3 py-2"><StatusBadge status={b.status} /></td>
                <td className="px-3 py-2"><Link href={`/dashboard/equipment/equipment/${b.equipment_id}?tab=breakdowns`} className="text-xs text-navy hover:underline">فتح</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
