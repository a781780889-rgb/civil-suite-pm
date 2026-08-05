'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight, LayoutDashboard, TriangleAlert, ScrollText, ClipboardCheck, Siren,
  ClipboardX, HardHat, Flame, DoorOpen, FileBarChart, Sparkles,
} from 'lucide-react';
import ActorBar from '@/components/pm/ActorBar.jsx';
import NotificationsBell from '@/components/hse/NotificationsBell.jsx';
import AiAssistantDrawer from '@/components/hse/AiAssistantDrawer.jsx';
import OverviewTab from '@/components/hse/tabs/OverviewTab.jsx';
import RisksTab from '@/components/hse/tabs/RisksTab.jsx';
import PermitsTab from '@/components/hse/tabs/PermitsTab.jsx';
import InspectionsTab from '@/components/hse/tabs/InspectionsTab.jsx';
import IncidentsTab from '@/components/hse/tabs/IncidentsTab.jsx';
import CorrectiveActionsTab from '@/components/hse/tabs/CorrectiveActionsTab.jsx';
import PpeTrainingTab from '@/components/hse/tabs/PpeTrainingTab.jsx';
import HazmatFireTab from '@/components/hse/tabs/HazmatFireTab.jsx';
import EmergencyTab from '@/components/hse/tabs/EmergencyTab.jsx';
import ReportsTab from '@/components/hse/tabs/ReportsTab.jsx';

const TABS = [
  { key: 'overview', label: 'نظرة عامة', icon: LayoutDashboard, Component: OverviewTab },
  { key: 'risks', label: 'المخاطر', icon: TriangleAlert, Component: RisksTab },
  { key: 'permits', label: 'تصاريح العمل', icon: ScrollText, Component: PermitsTab },
  { key: 'inspections', label: 'التفتيشات', icon: ClipboardCheck, Component: InspectionsTab },
  { key: 'incidents', label: 'الحوادث والبلاغات', icon: Siren, Component: IncidentsTab },
  { key: 'corrective', label: 'الإجراءات التصحيحية', icon: ClipboardX, Component: CorrectiveActionsTab },
  { key: 'ppe', label: 'الوقاية والتدريب', icon: HardHat, Component: PpeTrainingTab },
  { key: 'hazmat', label: 'المواد الخطرة والإطفاء', icon: Flame, Component: HazmatFireTab },
  { key: 'emergency', label: 'الطوارئ وخطط السلامة', icon: DoorOpen, Component: EmergencyTab },
  { key: 'reports', label: 'التقارير', icon: FileBarChart, Component: ReportsTab },
];

export default function HseProjectWorkspace() {
  const params = useParams();
  const projectId = Number(params.projectId);
  const [active, setActive] = useState('overview');
  const [project, setProject] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    fetch('/api/projects').then((r) => r.json()).then((res) => {
      setProject((res.projects || []).find((p) => p.id === projectId) || null);
    });
  }, [projectId]);

  const ActiveComponent = TABS.find((t) => t.key === active)?.Component || OverviewTab;

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/dashboard/hse" className="flex items-center gap-1 text-sm text-navy-600 hover:underline">
            <ArrowRight size={14} /> كل المشاريع
          </Link>
          <h1 className="mt-1 text-xl font-bold text-navy-800">السلامة المهنية — {project?.name || `مشروع #${projectId}`}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAiOpen(true)} className="flex items-center gap-1.5 rounded-sheet bg-navy-700 px-3 py-2 text-sm font-medium text-white hover:bg-navy-800">
            <Sparkles size={16} /> المساعد الذكي
          </button>
          <NotificationsBell projectId={projectId} />
          <ActorBar />
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-line pb-px">
        {TABS.map((tab) => (
          <button
            key={tab.key} onClick={() => setActive(tab.key)}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition ${
              active === tab.key ? 'border-navy-600 text-navy-700' : 'border-transparent text-ink-soft hover:text-ink'
            }`}
          >
            <tab.icon size={15} /> {tab.label}
          </button>
        ))}
      </div>

      <ActiveComponent projectId={projectId} />
      <AiAssistantDrawer projectId={projectId} open={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  );
}
