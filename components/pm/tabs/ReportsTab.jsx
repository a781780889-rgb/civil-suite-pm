'use client';
// components/pm/tabs/ReportsTab.jsx

import { useState } from 'react';
import { FileDown, Sparkles, Loader2 } from 'lucide-react';
import { pmReports, pmAi } from '@/lib/pmApi.js';
import { Section } from '@/components/pm/Shared.jsx';

const REPORT_TYPES = [
  { value: 'daily', label: 'التقرير اليومي' }, { value: 'weekly', label: 'التقرير الأسبوعي' }, { value: 'monthly', label: 'التقرير الشهري' },
  { value: 'progress', label: 'تقرير الإنجاز' }, { value: 'financial', label: 'التقرير المالي' }, { value: 'resources', label: 'تقرير الموارد' },
  { value: 'quality', label: 'تقرير الجودة' }, { value: 'safety', label: 'تقرير السلامة' }, { value: 'risk', label: 'تقرير المخاطر' }, { value: 'executive', label: 'التقرير التنفيذي' },
];

export default function ReportsTab({ projectId }) {
  const [type, setType] = useState('executive');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [narrative, setNarrative] = useState(null);
  const [narrating, setNarrating] = useState(false);

  async function generate() {
    setLoading(true); setReport(null); setNarrative(null);
    const res = await pmReports.get(type, projectId);
    setLoading(false);
    if (res.success) setReport(res.report);
  }

  async function narrate() {
    if (!report) return;
    setNarrating(true);
    const res = await pmAi.reportNarrative(type, report);
    setNarrating(false);
    if (res.success) setNarrative(res.narrative);
  }

  return (
    <Section title="مركز التقارير">
      <div className="flex flex-wrap gap-2 mb-4">
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-md border border-line px-3 py-2 text-sm">
          {REPORT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <button onClick={generate} disabled={loading} className="rounded-md bg-navy-700 text-white text-sm px-4 py-2 disabled:opacity-60">{loading ? 'جارِ الإعداد…' : 'إعداد التقرير'}</button>
        {report && (
          <>
            <a href={pmReports.exportUrl(type, projectId, 'excel')} className="flex items-center gap-1.5 rounded-md border border-line text-sm px-3 py-2 hover:border-navy-300"><FileDown size={13} /> Excel</a>
            <a href={pmReports.exportUrl(type, projectId, 'csv')} className="flex items-center gap-1.5 rounded-md border border-line text-sm px-3 py-2 hover:border-navy-300"><FileDown size={13} /> CSV</a>
            <button onClick={narrate} disabled={narrating} className="flex items-center gap-1.5 rounded-md border border-line text-sm px-3 py-2 hover:border-navy-300 disabled:opacity-60">
              {narrating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} ملخص تنفيذي بالذكاء الاصطناعي
            </button>
          </>
        )}
      </div>

      {narrative && <div className="rounded-md bg-navy-50 border border-navy-100 p-3 text-sm text-ink mb-4">{narrative.narrative}</div>}

      {report && (
        <pre className="rounded-md bg-paper border border-line p-3 text-[11px] overflow-x-auto whitespace-pre-wrap font-mono" dir="ltr">
          {JSON.stringify(report, null, 2)}
        </pre>
      )}
      {!report && !loading && <p className="text-sm text-ink-soft">اختر نوع التقرير ثم اضغط "إعداد التقرير".</p>}
    </Section>
  );
}
