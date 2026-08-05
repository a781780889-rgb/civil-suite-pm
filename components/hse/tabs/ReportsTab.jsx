'use client';
import { useEffect, useRef, useState } from 'react';
import { FileSpreadsheet, FileText, FileType, Download, Loader2 } from 'lucide-react';
import { Section } from '@/components/pm/Shared.jsx';
import { SelectField } from '@/components/ui/Field.jsx';
import { DateField } from '@/components/pm/PmField.jsx';
import { HSE_REPORT_TYPE_OPTIONS } from '@/lib/hseConstants.js';
import * as hseApi from '@/lib/hseApi.js';
import { exportNodeToPdf } from '@/lib/pdfExport.js';

export default function ReportsTab({ projectId }) {
  const [type, setType] = useState('incidents');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const tableRef = useRef(null);

  async function load() {
    setLoading(true);
    try { const res = await hseApi.fetchReportData(type, { project_id: projectId, from: from || undefined, to: to || undefined }); setReport(res); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [type, projectId]);

  async function downloadPdf() {
    setExportingPdf(true);
    try { await exportNodeToPdf(tableRef.current, `${report?.title || 'تقرير'}.pdf`); }
    finally { setExportingPdf(false); }
  }

  const downloadHref = (format) => hseApi.reportUrl(type, format, { project_id: projectId, from: from || undefined, to: to || undefined });

  return (
    <Section title="مركز تقارير السلامة">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <SelectField label="نوع التقرير" value={type} onChange={setType} options={HSE_REPORT_TYPE_OPTIONS} />
        <DateField label="من تاريخ" value={from} onChange={setFrom} />
        <DateField label="إلى تاريخ" value={to} onChange={setTo} />
        <button onClick={load} className="rounded-sheet bg-navy-700 px-3 py-2 text-sm font-medium text-white">تحديث</button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <a href={downloadHref('excel')} className="flex items-center gap-1.5 rounded-sheet border border-line px-3 py-2 text-sm hover:bg-paper"><FileSpreadsheet size={15} className="text-pass-DEFAULT" /> Excel</a>
        <a href={downloadHref('csv')} className="flex items-center gap-1.5 rounded-sheet border border-line px-3 py-2 text-sm hover:bg-paper"><FileText size={15} className="text-navy-600" /> CSV</a>
        <a href={downloadHref('word')} className="flex items-center gap-1.5 rounded-sheet border border-line px-3 py-2 text-sm hover:bg-paper"><FileType size={15} className="text-navy-600" /> Word</a>
        <button onClick={downloadPdf} disabled={exportingPdf} className="flex items-center gap-1.5 rounded-sheet border border-line px-3 py-2 text-sm hover:bg-paper disabled:opacity-50">
          {exportingPdf ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} className="text-fail-DEFAULT" />} PDF
        </button>
      </div>

      {loading && <p className="text-sm text-ink-soft">جارٍ تحميل التقرير...</p>}
      {report && (
        <div ref={tableRef} className="overflow-x-auto rounded-sheet border border-line bg-white p-4" dir="rtl">
          <h3 className="mb-1 text-lg font-bold text-navy-800">{report.title}</h3>
          <p className="mb-3 text-xs text-ink-soft">عدد السجلات: {report.rows.length}</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-right">
                {report.columns.map((c) => <th key={c.key} className="px-2 py-2 font-semibold text-ink">{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row, i) => (
                <tr key={i} className="border-b border-line">
                  {report.columns.map((c) => <td key={c.key} className="px-2 py-1.5 text-ink-soft">{String(row[c.key] ?? '-')}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
