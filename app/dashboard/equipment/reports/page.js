'use client';
import { useEffect, useState } from 'react';
import { FileSpreadsheet, FileText, Download } from 'lucide-react';
import ActorBar from '@/components/pm/ActorBar.jsx';
import NotificationsBell from '@/components/equipment/NotificationsBell.jsx';
import { Section } from '@/components/pm/Shared.jsx';
import { DateField } from '@/components/pm/PmField.jsx';
import { getReport, reportDownloadUrl } from '@/lib/equipmentApi.js';

const REPORT_TYPES = [
  { value: 'equipment', label: 'تقرير المعدات' }, { value: 'usage', label: 'تقرير الاستخدام' },
  { value: 'hours', label: 'تقرير ساعات التشغيل' }, { value: 'fuel', label: 'تقرير الوقود' },
  { value: 'maintenance', label: 'تقرير الصيانة' }, { value: 'breakdowns', label: 'تقرير الأعطال' },
  { value: 'spare_parts', label: 'تقرير قطع الغيار' }, { value: 'cost', label: 'تقرير تكلفة المعدات' },
  { value: 'by_project', label: 'تقرير المعدات حسب المشروع' }, { value: 'stopped', label: 'تقرير المعدات المتوقفة' },
  { value: 'rentals', label: 'تقرير المعدات المؤجرة' }, { value: 'productivity', label: 'تقرير الإنتاجية' },
];

export default function EquipmentReportsPage() {
  const [type, setType] = useState('equipment');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await getReport(type, { from: from || undefined, to: to || undefined });
      setReport(res);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-lg font-bold text-ink">تقارير المعدات</h1>
        <div className="flex items-center gap-2"><NotificationsBell /><ActorBar /></div>
      </div>

      <div className="flex items-end gap-3 flex-wrap">
        <label className="block">
          <span className="block text-xs font-medium text-ink-soft mb-1">نوع التقرير</span>
          <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-md border border-line px-3 py-2 text-sm bg-paper min-w-[220px]">
            {REPORT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <DateField label="من تاريخ" value={from} onChange={setFrom} />
        <DateField label="إلى تاريخ" value={to} onChange={setTo} />
        <button onClick={load} className="px-4 py-2 rounded-md bg-navy text-white text-sm">تطبيق</button>
        <div className="flex-1" />
        <a href={reportDownloadUrl(type, 'csv', { from, to })} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-md border border-line hover:bg-line/50"><Download size={14} /> CSV</a>
        <a href={reportDownloadUrl(type, 'excel', { from, to })} className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-md border border-line hover:bg-line/50"><FileSpreadsheet size={14} /> Excel</a>
      </div>

      <Section title={report?.title || ''}>
        {loading && <p className="text-sm text-ink-soft">جارِ التحميل...</p>}
        {!loading && report && report.rows.length === 0 && <p className="text-sm text-ink-soft py-6 text-center">لا توجد بيانات مطابقة لهذا التقرير</p>}
        {!loading && report && report.rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-line/40 text-ink-soft text-xs">
                <tr>{report.columns.map((c) => <th key={c.key} className="px-3 py-2 text-right font-medium whitespace-nowrap">{c.label}</th>)}</tr>
              </thead>
              <tbody>
                {report.rows.map((row, i) => (
                  <tr key={i} className="border-t border-line">
                    {report.columns.map((c) => <td key={c.key} className="px-3 py-2 text-ink whitespace-nowrap">{row[c.key] ?? '—'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
