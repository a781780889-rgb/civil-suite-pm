'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, FileDown, Sparkles, Loader2 } from 'lucide-react';
import { pmProjects, pmReports, pmAi } from '@/lib/pmApi.js';
import { Section } from '@/components/pm/Shared.jsx';
import ActorBar from '@/components/pm/ActorBar.jsx';

const REPORT_TYPES = [
  { value: 'daily', label: 'التقرير اليومي' }, { value: 'weekly', label: 'التقرير الأسبوعي' }, { value: 'monthly', label: 'التقرير الشهري' },
  { value: 'progress', label: 'تقرير الإنجاز' }, { value: 'financial', label: 'التقرير المالي' }, { value: 'resources', label: 'تقرير الموارد' },
  { value: 'quality', label: 'تقرير الجودة' }, { value: 'safety', label: 'تقرير السلامة' }, { value: 'risk', label: 'تقرير المخاطر' }, { value: 'executive', label: 'التقرير التنفيذي' },
];

export default function ReportsCenterPage() {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [type, setType] = useState('executive');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [narrative, setNarrative] = useState(null);
  const [narrating, setNarrating] = useState(false);

  useEffect(() => {
    pmProjects.list({ pageSize: 200 }).then((res) => { if (res.success) setProjects(res.rows); });
  }, []);

  async function generate() {
    if (!projectId) return;
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
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Link href="/dashboard/pm" className="inline-flex items-center gap-1 text-xs text-ink-soft hover:text-navy-600 mb-1.5"><ArrowRight size={12} /> إدارة المشاريع</Link>
          <h1 className="text-2xl font-bold text-navy-700">مركز التقارير</h1>
          <p className="text-ink-soft text-sm mt-1">تقارير ديناميكية من بيانات حقيقية، قابلة للتصدير Excel/CSV.</p>
        </div>
        <ActorBar />
      </div>

      <Section>
        <div className="flex flex-wrap gap-2">
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="rounded-md border border-line px-3 py-2 text-sm min-w-[200px]">
            <option value="">اختر مشروعاً…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-md border border-line px-3 py-2 text-sm">
            {REPORT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <button onClick={generate} disabled={loading || !projectId} className="rounded-md bg-navy-700 text-white text-sm px-4 py-2 disabled:opacity-60">{loading ? 'جارِ الإعداد…' : 'إعداد التقرير'}</button>
          {report && (
            <>
              <a href={pmReports.exportUrl(type, projectId, 'excel')} className="flex items-center gap-1.5 rounded-md border border-line text-sm px-3 py-2 hover:border-navy-300"><FileDown size={13} /> Excel</a>
              <a href={pmReports.exportUrl(type, projectId, 'csv')} className="flex items-center gap-1.5 rounded-md border border-line text-sm px-3 py-2 hover:border-navy-300"><FileDown size={13} /> CSV</a>
              <button onClick={narrate} disabled={narrating} className="flex items-center gap-1.5 rounded-md border border-line text-sm px-3 py-2 hover:border-navy-300 disabled:opacity-60">
                {narrating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} ملخص تنفيذي
              </button>
            </>
          )}
        </div>

        {narrative && <div className="rounded-md bg-navy-50 border border-navy-100 p-3 text-sm text-ink mt-4">{narrative.narrative}</div>}
        {report && (
          <pre className="rounded-md bg-paper border border-line p-3 text-[11px] overflow-x-auto whitespace-pre-wrap font-mono mt-4" dir="ltr">
            {JSON.stringify(report, null, 2)}
          </pre>
        )}
      </Section>
    </div>
  );
}
