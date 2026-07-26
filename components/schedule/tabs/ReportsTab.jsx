'use client';
import { useRef, useState } from 'react';
import { FileDown, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { schReports } from '@/lib/scheduleApi.js';
import { exportNodeToPdf } from '@/lib/pdfExport.js';
import { Section, EmptyState } from '@/components/pm/Shared.jsx';

const REPORT_TYPES = [
  { value: 'summary', label: 'تقرير الجدول الزمني' },
  { value: 'progress', label: 'تقرير نسبة الإنجاز' },
  { value: 'critical_path', label: 'تقرير المسار الحرج' },
  { value: 'resources', label: 'تقرير الموارد' },
  { value: 'delay', label: 'تقرير التأخير' },
  { value: 'variance', label: 'مقارنة المخطط بالفعلي' },
  { value: 'executive', label: 'التقرير التنفيذي' },
];

export default function ReportsTab({ schedule }) {
  const [type, setType] = useState('summary');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const printRef = useRef(null);

  async function load(t) {
    setType(t);
    setLoading(true);
    const res = await schReports.get(schedule.id, t);
    setLoading(false);
    if (res.success) setReport(res.report);
  }

  async function downloadPdf() {
    if (!printRef.current) return;
    await exportNodeToPdf(printRef.current, `schedule-${type}-${schedule.id}.pdf`);
  }

  const activitiesList = report?.activities || [];

  return (
    <div className="grid lg:grid-cols-4 gap-4">
      <div className="lg:col-span-1">
        <Section title="نوع التقرير">
          <div className="space-y-1">
            {REPORT_TYPES.map((r) => (
              <button key={r.value} onClick={() => load(r.value)} className={`w-full text-right px-2.5 py-2 rounded-md text-sm transition-colors ${type === r.value ? 'bg-navy-600 text-white font-bold' : 'text-ink hover:bg-paper'}`}>
                {r.label}
              </button>
            ))}
          </div>
        </Section>
      </div>

      <div className="lg:col-span-3 space-y-3">
        <div className="flex items-center gap-2 justify-end">
          <a href={schReports.exportUrl(schedule.id, type, 'csv')} className="flex items-center gap-1.5 text-xs rounded-md border border-line px-3 py-1.5 hover:bg-paper transition-colors"><FileText size={13} /> CSV</a>
          <a href={schReports.exportUrl(schedule.id, type, 'excel')} className="flex items-center gap-1.5 text-xs rounded-md border border-line px-3 py-1.5 hover:bg-paper transition-colors"><FileSpreadsheet size={13} /> Excel</a>
          <button onClick={downloadPdf} disabled={!report} className="flex items-center gap-1.5 text-xs rounded-md border border-line px-3 py-1.5 hover:bg-paper disabled:opacity-50 transition-colors"><FileDown size={13} /> PDF</button>
          <button onClick={() => window.print()} disabled={!report} className="flex items-center gap-1.5 text-xs rounded-md border border-line px-3 py-1.5 hover:bg-paper disabled:opacity-50 transition-colors"><Printer size={13} /> طباعة</button>
        </div>

        {loading && <p className="text-sm text-ink-soft">جارِ التحميل…</p>}
        {!loading && !report && <EmptyState title="اختر نوع تقرير من القائمة" />}

        {!loading && report && (
          <div ref={printRef} className="rounded-sheet border border-line bg-white p-5">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-line">
              <div>
                <h2 className="font-bold text-navy-800">{REPORT_TYPES.find((r) => r.value === type)?.label}</h2>
                <p className="text-xs text-ink-soft">{report.schedule?.project_name} — {report.schedule?.name}</p>
              </div>
              <span className="text-[10px] font-mono text-ink-soft" dir="ltr">{new Date().toISOString().slice(0, 10)}</span>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {Object.entries(report).filter(([k, v]) => typeof v !== 'object').map(([k, v]) => (
                <div key={k} className="text-xs">
                  <span className="block text-ink-soft">{k}</span>
                  <span className="font-mono font-bold text-navy-700">{String(v)}</span>
                </div>
              ))}
            </div>

            {activitiesList.length > 0 && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-ink-soft border-b border-line">
                    {Object.keys(activitiesList[0]).slice(0, 6).map((k) => <th key={k} className="text-right font-medium px-2 py-1.5">{k}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {activitiesList.map((row, i) => (
                    <tr key={i} className="border-b border-line/60">
                      {Object.keys(activitiesList[0]).slice(0, 6).map((k) => <td key={k} className="px-2 py-1.5 font-mono">{String(row[k] ?? '—')}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {report.byType && (
              <table className="w-full text-xs mt-3">
                <thead><tr className="text-ink-soft border-b border-line"><th className="text-right px-2 py-1.5">النوع</th><th className="text-right px-2 py-1.5">العدد</th><th className="text-right px-2 py-1.5">التكلفة</th></tr></thead>
                <tbody>{report.byType.map((t) => <tr key={t.resource_type} className="border-b border-line/60"><td className="px-2 py-1.5">{t.resource_type}</td><td className="px-2 py-1.5 font-mono">{t.count}</td><td className="px-2 py-1.5 font-mono">{t.totalCost.toLocaleString()}</td></tr>)}</tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
