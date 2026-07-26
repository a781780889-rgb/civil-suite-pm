'use client';
// app/dashboard/schedule/schedules/[id]/page.js — مساحة عمل الجدول الزمني (تبويبات).

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight, LayoutGrid, ListTree, GanttChartSquare, Boxes, TrendingUp, Layers3, FileBarChart, Sparkles, ScrollText, Lock,
} from 'lucide-react';
import { schSchedules } from '@/lib/scheduleApi.js';
import ActorBar from '@/components/pm/ActorBar.jsx';
import NotificationsBell from '@/components/pm/NotificationsBell.jsx';

import OverviewTab from '@/components/schedule/tabs/OverviewTab.jsx';
import ActivitiesTab from '@/components/schedule/tabs/ActivitiesTab.jsx';
import GanttTab from '@/components/schedule/tabs/GanttTab.jsx';
import ResourcesTab from '@/components/schedule/tabs/ResourcesTab.jsx';
import ProgressTab from '@/components/schedule/tabs/ProgressTab.jsx';
import BaselinesTab from '@/components/schedule/tabs/BaselinesTab.jsx';
import ReportsTab from '@/components/schedule/tabs/ReportsTab.jsx';
import AiTab from '@/components/schedule/tabs/AiTab.jsx';
import AuditTab from '@/components/schedule/tabs/AuditTab.jsx';

const TABS = [
  { key: 'overview', label: 'نظرة عامة', icon: LayoutGrid },
  { key: 'activities', label: 'الأنشطة (WBS)', icon: ListTree },
  { key: 'gantt', label: 'مخطط جانت', icon: GanttChartSquare },
  { key: 'resources', label: 'الموارد', icon: Boxes },
  { key: 'progress', label: 'المتابعة والتقدّم', icon: TrendingUp },
  { key: 'baselines', label: 'خطوط الأساس', icon: Layers3 },
  { key: 'reports', label: 'التقارير', icon: FileBarChart },
  { key: 'ai', label: 'المساعد الذكي', icon: Sparkles },
  { key: 'audit', label: 'سجل التدقيق', icon: ScrollText },
];

export default function ScheduleWorkspacePage() {
  const { id } = useParams();
  const scheduleId = Number(id);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  const reload = useCallback(async () => {
    const res = await schSchedules.get(scheduleId);
    if (res.success) setData(res);
    setLoading(false);
  }, [scheduleId]);

  useEffect(() => { reload(); }, [reload]);

  if (loading) return <div className="text-sm text-ink-soft">جارِ التحميل…</div>;
  if (!data) return <div className="text-sm text-fail-700">تعذّر العثور على هذا الجدول الزمني.</div>;

  const { schedule, activities, relationships } = data;
  const ActiveComponent = {
    overview: OverviewTab, activities: ActivitiesTab, gantt: GanttTab, resources: ResourcesTab,
    progress: ProgressTab, baselines: BaselinesTab, reports: ReportsTab, ai: AiTab, audit: AuditTab,
  }[tab];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/dashboard/schedule/schedules" className="text-ink-soft hover:text-navy-600 shrink-0"><ArrowRight size={18} /></Link>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-navy-800 truncate flex items-center gap-1.5">
              {schedule.name}
              {!!schedule.is_locked && <Lock size={14} className="text-warnclr-DEFAULT shrink-0" title="الجدول مُقفل" />}
            </h1>
            <p className="text-xs text-ink-soft truncate">{schedule.project_name} · {schedule.project_code}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <NotificationsBell projectId={schedule.project_id} />
          <ActorBar />
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-line pb-px">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm border-b-2 transition-colors ${
                active ? 'border-navy-600 text-navy-700 font-bold' : 'border-transparent text-ink-soft hover:text-ink'
              }`}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      <ActiveComponent schedule={schedule} activities={activities} relationships={relationships} onChanged={reload} />
    </div>
  );
}
