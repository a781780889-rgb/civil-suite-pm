'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Archive, ArrowLeft } from 'lucide-react';
import { pmProjects, PROJECT_STATUS_LABELS, PROJECT_PRIORITY_LABELS } from '@/lib/pmApi.js';
import { ProjectStatusBadge, PriorityBadge } from '@/components/pm/StatusBadge.jsx';
import { EmptyState } from '@/components/pm/Shared.jsx';
import ProjectFormModal from '@/components/pm/ProjectFormModal.jsx';
import ActorBar from '@/components/pm/ActorBar.jsx';

export default function ProjectsListPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    const res = await pmProjects.list({ search: search || undefined, status: status || undefined, is_archived: showArchived ? '1' : undefined, pageSize: 100 });
    setLoading(false);
    if (res.success) setRows(res.rows);
  }

  useEffect(() => { load(); }, [status, showArchived]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-700">المشاريع</h1>
          <p className="text-ink-soft text-sm mt-1">كل المشاريع الهندسية المُدارة في النظام.</p>
        </div>
        <div className="flex items-center gap-2">
          <ActorBar />
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 rounded-md bg-navy-700 text-white text-sm font-medium px-4 py-2 hover:bg-navy-800 transition-colors">
            <Plus size={15} /> مشروع جديد
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-concrete-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            placeholder="ابحث بالاسم أو رقم المشروع أو العميل…"
            className="w-full rounded-md border border-line bg-white pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300"
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-line bg-white px-3 py-2 text-sm">
          <option value="">كل الحالات</option>
          {Object.entries(PROJECT_STATUS_LABELS).filter(([k]) => k !== 'archived').map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <button
          onClick={() => setShowArchived((v) => !v)}
          className={`flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors ${showArchived ? 'border-navy-400 bg-navy-50 text-navy-700' : 'border-line bg-white text-ink-soft'}`}
        >
          <Archive size={13} /> المؤرشفة
        </button>
      </div>

      {loading && <p className="text-sm text-ink-soft">جارِ التحميل…</p>}

      {!loading && rows.length === 0 && (
        <EmptyState icon={Archive} title="لا توجد مشاريع" message="ابدأ بإنشاء أول مشروع في النظام." action={
          <button onClick={() => setShowForm(true)} className="rounded-md bg-navy-700 text-white text-sm px-4 py-2">إنشاء مشروع</button>
        } />
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.map((p) => (
          <Link key={p.id} href={`/dashboard/pm/projects/${p.id}`} className="rounded-sheet border border-line bg-white p-4 hover:border-navy-400 hover:shadow-sheet transition-all block">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-bold text-ink text-sm leading-snug">{p.name}</h3>
              <ArrowLeft size={14} className="text-concrete-300 shrink-0 mt-0.5" />
            </div>
            {p.project_code && <p className="text-[11px] text-ink-soft font-mono mb-2" dir="ltr">{p.project_code}</p>}
            <div className="flex items-center gap-1.5 flex-wrap mb-3">
              <ProjectStatusBadge status={p.status} />
              <PriorityBadge priority={p.priority} />
            </div>
            <div className="text-xs text-ink-soft space-y-1">
              {p.client_name && <p>العميل: <span className="text-ink">{p.client_name}</span></p>}
              {(p.start_date || p.end_date) && <p className="font-mono tabular-figure" dir="ltr">{p.start_date || '—'} → {p.end_date || '—'}</p>}
              {p.budget > 0 && <p>الميزانية: <span className="text-ink font-mono tabular-figure">{Number(p.budget).toLocaleString('en-US')} {p.currency}</span></p>}
            </div>
          </Link>
        ))}
      </div>

      {showForm && <ProjectFormModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}
