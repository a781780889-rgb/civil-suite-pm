'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import ActorBar from '@/components/pm/ActorBar.jsx';
import NotificationsBell from '@/components/equipment/NotificationsBell.jsx';
import StatusBadge from '@/components/equipment/StatusBadge.jsx';
import { listRentals } from '@/lib/equipmentApi.js';

export default function RentalsOverviewPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listRentals({ pageSize: 100 }).then((res) => setRows(res.rows || [])).finally(() => setLoading(false));
  }, []);

  const activeCost = rows.filter((r) => r.contract_status === 'active').reduce((s, r) => s + Number(r.rental_cost_total || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">المعدات المؤجرة</h1>
          <p className="text-xs text-ink-soft">{rows.length} عقد — إجمالي تكلفة العقود النشطة: {activeCost.toFixed(2)}</p>
        </div>
        <div className="flex items-center gap-2"><NotificationsBell /><ActorBar /></div>
      </div>

      <div className="rounded-lg border border-line overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-line/40 text-ink-soft text-xs">
            <tr>
              <th className="px-3 py-2 text-right font-medium">المعدة</th>
              <th className="px-3 py-2 text-right font-medium">شركة التأجير</th>
              <th className="px-3 py-2 text-right font-medium">بداية العقد</th>
              <th className="px-3 py-2 text-right font-medium">نهاية العقد</th>
              <th className="px-3 py-2 text-right font-medium">التكلفة</th>
              <th className="px-3 py-2 text-right font-medium">الحالة</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="px-3 py-6 text-center text-ink-soft">جارِ التحميل...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-ink-soft">لا توجد معدات مؤجرة</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line hover:bg-line/20">
                <td className="px-3 py-2 font-medium text-ink">{r.equipment_name}</td>
                <td className="px-3 py-2 text-ink-soft">{r.rental_company}</td>
                <td className="px-3 py-2 text-ink-soft">{r.rental_start}</td>
                <td className="px-3 py-2 text-ink-soft">{r.rental_end || 'مفتوح'}</td>
                <td className="px-3 py-2 font-mono text-ink-soft">{r.rental_cost_total}</td>
                <td className="px-3 py-2"><StatusBadge status={r.contract_status} /></td>
                <td className="px-3 py-2"><Link href={`/dashboard/equipment/equipment/${r.equipment_id}?tab=rentals`} className="text-xs text-navy hover:underline">فتح</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
