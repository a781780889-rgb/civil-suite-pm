'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  ArrowRight, LayoutDashboard, Milestone, ListChecks, Users, Wallet, Truck,
  ShieldAlert, ShieldCheck, FileText, CalendarClock, FileBarChart, History, Pencil,
} from 'lucide-react';
import { pmProjects } from '@/lib/pmApi.js';
import { ProjectStatusBadge, PriorityBadge } from '@/components/pm/StatusBadge.jsx';
import ActorBar from '@/components/pm/ActorBar.jsx';
import NotificationsBell from '@/components/pm/NotificationsBell.jsx';
import ProjectFormModal from '@/components/pm/ProjectFormModal.jsx';
import AiAssistantDrawer from '@/components/pm/AiAssistantDrawer.jsx';

import OverviewTab from '@/components/pm/tabs/OverviewTab.jsx';
import PhasesTab from '@/components/pm/tabs/PhasesTab.jsx';
import TasksTab from '@/components/pm/tabs/TasksTab.jsx';
import TeamTab from '@/components/pm/tabs/TeamTab.jsx';
import BudgetTab from '@/components/pm/tabs/BudgetTab.jsx';
import ResourcesTab from '@/components/pm/tabs/ResourcesTab.jsx';
import RisksTab from '@/components/pm/tabs/RisksTab.jsx';
import QualitySafetyTab from '@/components/pm/tabs/QualitySafetyTab.jsx';
import DocumentsTab from '@/components/pm/tabs/DocumentsTab.jsx';
import MeetingsTab from '@/components/pm/tabs/MeetingsTab.jsx';
import ReportsTab from '@/components/pm/tabs/ReportsTab.jsx';
import AuditTab from '@/components/pm/tabs/AuditTab.jsx';

const TABS = [
  { key: 'overview', label: 'نظرة عامة', icon: LayoutDashboard },
  { key: 'phases', label: 'المراحل', icon: Milestone },
  { key: 'tasks', label: 'المهام والجدول الزمني', icon: ListChecks },
  { key: 'team', label: 'الفريق', icon: Users },
  { key: 'budget', label: 'الميزانية', icon: Wallet },
  { key: 'resources', label: 'الموارد', icon: Truck },
  { key: 'risks', label: 'المخاطر', icon: ShieldAlert },
  { key: 'quality-safety', label: 'الجودة والسلامة', icon: ShieldCheck },
  { key: 'documents', label: 'المستندات', icon: FileText },
  { key: 'meetings', label: 'الاجتماعات', icon: CalendarClock },
  { key: 'reports', label: 'التقارير', icon: FileBarChart },
  { key: 'audit', label: 'سجل التدقيق', icon: History },
];

export default function ProjectWorkspacePage({ params }) {
  const { id } = use(params);
  const projectId = Number(id);
  const [stats, setStats] = useState(null);
  const [tab, setTab] = useState('overview');
  const [showEdit, setShowEdit] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const res = await pmProjects.get(projectId);
    if (res.success) setStats(res);
    else setError(res.error || 'تعذّر تحميل المشروع.');
  }

  useEffect(() => { load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="rounded-sheet border border-fail-100 bg-fail-50 text-fail-700 p-5 text-sm">{error}</div>
    );
  }
  if (!stats) return <p className="text-sm text-ink-soft">جارِ التحميل…</p>;

  const { project } = stats;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <Link href="/dashboard/pm/projects" className="inline-flex items-center gap-1 text-xs text-ink-soft hover:text-navy-600 mb-1.5">
            <ArrowRight size={12} /> كل المشاريع
          </Link>
          <h1 className="text-xl font-bold text-navy-700 truncate">{project.name}</h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <ProjectStatusBadge status={project.status} />
            <PriorityBadge priority={project.priority} />
            {project.project_code && <span className="text-[11px] text-ink-soft font-mono" dir="ltr">{project.project_code}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NotificationsBell projectId={projectId} />
          <ActorBar />
          <button onClick={() => setShowEdit(true)} className="flex items-center gap-1.5 rounded-md border border-line bg-white text-sm px-3 py-2 hover:border-navy-300 transition-colors">
            <Pencil size={13} /> تعديل
          </button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-xs font-medium border-b-2 transition-colors shrink-0 ${
              tab === t.key ? 'border-navy-600 text-navy-700' : 'border-transparent text-ink-soft hover:text-ink'
            }`}
          >
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      <div>
        {tab === 'overview' && <OverviewTab stats={stats} onChanged={load} />}
        {tab === 'phases' && <PhasesTab projectId={projectId} onChanged={load} />}
        {tab === 'tasks' && <TasksTab projectId={projectId} project={project} onChanged={load} />}
        {tab === 'team' && <TeamTab projectId={projectId} />}
        {tab === 'budget' && <BudgetTab projectId={projectId} project={project} onChanged={load} />}
        {tab === 'resources' && <ResourcesTab projectId={projectId} />}
        {tab === 'risks' && <RisksTab projectId={projectId} />}
        {tab === 'quality-safety' && <QualitySafetyTab projectId={projectId} />}
        {tab === 'documents' && <DocumentsTab projectId={projectId} />}
        {tab === 'meetings' && <MeetingsTab projectId={projectId} />}
        {tab === 'reports' && <ReportsTab projectId={projectId} />}
        {tab === 'audit' && <AuditTab projectId={projectId} />}
      </div>

      <AiAssistantDrawer projectId={projectId} />

      {showEdit && <ProjectFormModal project={project} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); load(); }} />}
    </div>
  );
}
