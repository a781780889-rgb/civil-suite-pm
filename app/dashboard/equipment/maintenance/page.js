'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import ActorBar from '@/components/pm/ActorBar.jsx';
import NotificationsBell from '@/components/equipment/NotificationsBell.jsx';
import StatusBadge from '@/components/equipment/StatusBadge.jsx';
import { listMaintenanceRecords, listMaintenanceSchedules } from '@/lib/equipmentApi.js';

export default function MaintenanceOverviewPage() {
  const [records, setRecords] = useState([]);
  const [dueSoon, setDueSoon] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  async function load() {
    setLoading(true);
    const [r, s] = await Promise.all([
      listMaintenanceRecords({ status: statusFilter || undefined, pageSize: 100 }),
      listMaintenanceSchedules({ equipment_id: undefined }),
    ]);
    setRecords(r.rows || []);
    setDueSoon(s.rows || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">الصيانة عبر الأسطول</h1>
          <p className="text-xs text-ink-soft">لتسجيل صيانة جديدة، افتح المعدة المطلوبة ثم تبويب «الصيانة»</p>
        </div>
        <div className="flex items-center gap-2"><NotificationsBell /><ActorBar /></div>
      </div>

      <div className="rounded-lg border border-line bg-white p-4">
        <h2 className="text-sm font-bold text-ink mb-3">جداول الصيانة المستحقة قريباً ({dueSoon.length})</h2>
        {dueSoon.length === 0 && <p className="text-sm text-ink-soft">لا توجد جداول صيانة نشطة حالياً</p>}
        <div className="space-y-1.5">
          {dueSoon.map((s) => (
            <div key={s.id} className="flex items-center justify-between text-sm py-1 border-b border-line last:border-0">
              <span className="text-ink">{s.title}</span>
              <span className="text-xs text-ink-soft">{s.next_due_date || `عند ${s.next_due_hour_meter} ساعة`}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-md border border-line px-3 py-2 text-sm bg-paper">
          <option value="">كل الحالات</option>
          <option value="completed">مكتملة</option>
          <option value="in_progress">قيد التنفيذ</option>
          <option value="scheduled">مجدولة</option>
        </select>
      </div>

      <div className="rounded-lg border border-line overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-line/40 text-ink-soft text-xs">
            <tr>
              <th className="px-3 py-2 text-right font-medium">المعدة</th>
              <th className="px-3 py-2 text-right font-medium">التاريخ</th>
              <th className="px-3 py-2 text-right font-medium">النوع</th>
              <th className="px-3 py-2 text-right font-medium">العنوان</th>
              <th className="px-3 py-2 text-right font-medium">التكلفة</th>
              <th className="px-3 py-2 text-right font-medium">الحالة</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="px-3 py-6 text-center text-ink-soft">جارِ التحميل...</td></tr>}
            {!loading && records.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-ink-soft">لا توجد سجلات صيانة</td></tr>}
            {records.map((r) => (
              <tr key={r.id} className="border-t border-line hover:bg-line/20">
                <td className="px-3 py-2 font-medium text-ink">{r.equipment_name}</td>
                <td className="px-3 py-2 text-ink-soft">{r.maintenance_date}</td>
                <td className="px-3 py-2 text-ink-soft">{r.maintenance_type === 'preventive' ? 'وقائية' : 'تصحيحية'}</td>
                <td className="px-3 py-2 text-ink-soft">{r.title}</td>
                <td className="px-3 py-2 font-mono text-ink-soft">{r.total_cost}</td>
                <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                <td className="px-3 py-2"><Link href={`/dashboard/equipment/equipment/${r.equipment_id}?tab=maintenance`} className="text-xs text-navy hover:underline">فتح</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
