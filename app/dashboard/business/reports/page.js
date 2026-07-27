'use client';
import { useState } from 'react';
import { FileBarChart, Download, Table2 } from 'lucide-react';
import { Section } from '@/components/pm/Shared.jsx';
import { getReport, reportDownloadUrl } from '@/lib/businessApi.js';

const REPORTS = [
  { type: 'clients', label: 'تقرير العملاء' }, { type: 'opportunities', label: 'تقرير الفرص' },
  { type: 'quotes', label: 'تقرير عروض الأسعار' }, { type: 'contracts', label: 'تقرير العقود' },
  { type: 'contractors', label: 'تقرير المقاولين' }, { type: 'suppliers', label: 'تقرير الموردين' },
  { type: 'work_orders', label: 'تقرير أوامر العمل' }, { type: 'payments', label: 'تقرير المستخلصات والدفعات' },
  { type: 'change_orders', label: 'تقرير التغييرات' }, { type: 'commitments', label: 'تقرير الالتزامات' },
  { type: 'executive', label: 'التقرير التنفيذي' },
];

export default function BusinessReportsPage() {
  const [active, setActive] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  async function view(type) {
    setActive(type); setLoading(true); setData(null);
    try { setData((await getReport(type)).report); } finally { setLoading(false); }
  }

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-ink">مركز تقارير إدارة الأعمال</h1>
        <p className="text-sm text-ink-soft mt-0.5">اعرض أي تقرير مباشرة أو صدّره كملف Excel أو CSV</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {REPORTS.map((r) => (
          <div key={r.type} className={`bg-white border rounded-lg p-4 transition-colors ${active === r.type ? 'border-navy-300 ring-1 ring-navy-200' : 'border-line'}`}>
            <div className="flex items-center gap-2 mb-3"><FileBarChart size={16} className="text-navy" /><span className="font-medium text-sm text-ink">{r.label}</span></div>
            <div className="flex gap-2">
              <button onClick={() => view(r.type)} className="flex-1 flex items-center justify-center gap-1 text-xs font-medium py-1.5 rounded-md bg-navy/10 text-navy hover:bg-navy/20"><Table2 size={12} /> عرض</button>
              <a href={reportDownloadUrl(r.type, 'excel')} className="flex items-center justify-center gap-1 text-xs font-medium py-1.5 px-2 rounded-md border border-line hover:bg-line/50"><Download size={12} /> Excel</a>
              <a href={reportDownloadUrl(r.type, 'csv')} className="flex items-center justify-center gap-1 text-xs font-medium py-1.5 px-2 rounded-md border border-line hover:bg-line/50"><Download size={12} /> CSV</a>
            </div>
          </div>
        ))}
      </div>

      {active && (
        <Section title={REPORTS.find((r) => r.type === active)?.label || ''}>
          {loading ? (
            <div className="text-sm text-ink-soft py-6 text-center">جارٍ التحميل...</div>
          ) : data ? (
            <ReportPreview type={active} data={data} />
          ) : null}
        </Section>
      )}
    </div>
  );
}

function ReportPreview({ type, data }) {
  if (type === 'executive') {
    return (
      <div className="space-y-3 text-sm">
        <pre className="bg-line/30 rounded-md p-3 overflow-x-auto text-xs" dir="ltr">{JSON.stringify(data.kpis, null, 2)}</pre>
      </div>
    );
  }
  const totals = data.totals || {};
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {Object.entries(totals).filter(([, v]) => typeof v !== 'object').map(([k, v]) => (
          <div key={k} className="bg-line/30 rounded-md px-3 py-2 text-sm"><span className="text-ink-soft">{k}:</span> <span className="font-bold text-ink">{String(v)}</span></div>
        ))}
      </div>
      <div className="text-xs text-ink-soft">إجمالي السجلات: {(data[Object.keys(data).find((k) => Array.isArray(data[k]))] || []).length}</div>
    </div>
  );
}
