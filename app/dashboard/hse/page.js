'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShieldAlert, Siren, FileWarning, ClipboardCheck, HardHat, GraduationCap, Sparkles, ChevronLeft, TriangleAlert,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ActorBar from '@/components/pm/ActorBar.jsx';
import { StatCard, Section, EmptyState } from '@/components/pm/Shared.jsx';
import { StatusBadge, RiskLevelBadge } from '@/components/hse/StatusBadge.jsx';
import NotificationsBell from '@/components/hse/NotificationsBell.jsx';
import AiAssistantDrawer from '@/components/hse/AiAssistantDrawer.jsx';
import * as hseApi from '@/lib/hseApi.js';

export default function HseDashboardPage() {
  const [projects, setProjects] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [projectsRes, dashboardRes] = await Promise.all([
          fetch('/api/projects').then((r) => r.json()),
          hseApi.getDashboard({}),
        ]);
        setProjects(projectsRes.projects || []);
        setDashboard(dashboardRes.dashboard);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const chartData = dashboard ? [
    { name: 'حوادث', value: dashboard.totals.incident_count },
    { name: 'Near Miss', value: dashboard.totals.near_miss_count },
    { name: 'مخالفات مفتوحة', value: dashboard.totals.open_violation_count },
    { name: 'مخاطر حرجة', value: dashboard.totals.critical_risk_count },
    { name: 'تصاريح نشطة', value: dashboard.totals.active_permits },
  ] : [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-navy-800">
            <ShieldAlert size={26} className="text-navy-600" /> إدارة السلامة المهنية
          </h1>
          <p className="mt-1 text-sm text-ink-soft">القسم الثامن — نظام HSE متكامل عبر كل المشاريع</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAiOpen(true)} className="flex items-center gap-1.5 rounded-sheet bg-navy-700 px-3 py-2 text-sm font-medium text-white hover:bg-navy-800">
            <Sparkles size={16} /> المساعد الذكي
          </button>
          <NotificationsBell />
          <ActorBar />
        </div>
      </div>

      {loading && <p className="text-sm text-ink-soft">جارٍ تحميل مؤشرات السلامة...</p>}

      {dashboard && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard icon={Siren} label="إجمالي الحوادث" value={dashboard.totals.incident_count} tone="fail" />
            <StatCard icon={FileWarning} label="مخاطر حرجة مفتوحة" value={dashboard.totals.critical_risk_count} tone="fail" />
            <StatCard icon={ClipboardCheck} label="تفتيشات مكتملة" value={`${dashboard.totals.inspections_completed}/${dashboard.totals.inspections_total}`} tone="navy" />
            <StatCard icon={HardHat} label="تصاريح عمل نشطة" value={dashboard.totals.active_permits} tone="navy" />
            <StatCard icon={TriangleAlert} label="نسبة الالتزام العام" value={dashboard.kpis.compliance_rate !== null ? `${dashboard.kpis.compliance_rate}%` : '—'} tone={dashboard.kpis.compliance_rate >= 80 ? 'pass' : 'warn'} />
            <StatCard icon={Siren} label="معدل تكرار الحوادث" value={dashboard.kpis.incident_frequency_rate ?? '—'} small tone="navy" />
            <StatCard icon={GraduationCap} label="الالتزام بالتدريب" value={dashboard.kpis.training_compliance_rate !== null ? `${dashboard.kpis.training_compliance_rate}%` : '—'} tone="navy" small />
            <StatCard icon={ShieldAlert} label="مشاريع ملتزمة" value={`${dashboard.totals.projects_compliant}/${dashboard.totals.total_projects}`} tone="pass" small />
          </div>

          <Section title="مؤشرات السلامة الرئيسية">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E9F0" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#2A4C7A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>

          <div className="grid gap-4 md:grid-cols-2">
            <Section title="آخر التنبيهات">
              {dashboard.recent_notifications.length === 0 ? <EmptyState title="لا تنبيهات" message="لا توجد تنبيهات سلامة حالياً." /> : (
                <ul className="divide-y divide-line">
                  {dashboard.recent_notifications.map((n) => (
                    <li key={n.id} className="py-2 text-sm">
                      <p className="font-medium text-ink">{n.title}</p>
                      {n.message && <p className="text-xs text-ink-soft">{n.message}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            <Section title="آخر عمليات التفتيش">
              {dashboard.recent_inspections.length === 0 ? <EmptyState title="لا تفتيشات" message="لم تُسجَّل تفتيشات بعد." /> : (
                <ul className="divide-y divide-line">
                  {dashboard.recent_inspections.map((i) => (
                    <li key={i.id} className="flex items-center justify-between py-2 text-sm">
                      <span>{i.inspection_no} — {i.inspection_date}</span>
                      <StatusBadge status={i.status} small />
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </>
      )}

      <Section title="المشاريع">
        {projects.length === 0 ? <EmptyState title="لا مشاريع" message="أضف مشروعاً أولاً من قسم إدارة المشاريع." /> : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link key={p.id} href={`/dashboard/hse/${p.id}`} className="flex items-center justify-between rounded-sheet border border-line bg-white p-4 hover:border-navy-300 hover:shadow-sheet">
                <span className="font-medium text-ink">{p.name}</span>
                <ChevronLeft size={18} className="text-ink-soft" />
              </Link>
            ))}
          </div>
        )}
      </Section>

      <AiAssistantDrawer projectId={null} open={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  );
}
