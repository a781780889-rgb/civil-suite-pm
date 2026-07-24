'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FolderKanban, Activity, PlayCircle, CheckCircle2, PauseCircle, AlertTriangle, Clock,
  Wallet, TrendingUp, TrendingDown, ListChecks, Users, FileBarChart, ArrowLeft,
} from 'lucide-react';
import { pmDashboard } from '@/lib/pmApi.js';
import { StatCard } from '@/components/pm/Shared.jsx';
import ActorBar from '@/components/pm/ActorBar.jsx';
import NotificationsBell from '@/components/pm/NotificationsBell.jsx';
import { ProjectStatusBadge } from '@/components/pm/StatusBadge.jsx';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const STATUS_COLORS = { planning: '#8B9296', in_progress: '#16324F', stopped: '#B8860B', completed: '#2F7A4F', cancelled: '#B23A32' };
const STATUS_LABELS = { planning: 'قيد التخطيط', in_progress: 'قيد التنفيذ', stopped: 'متوقف', completed: 'مكتمل', cancelled: 'ملغي' };

export default function PmDashboardPage() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    pmDashboard.stats().then((res) => { if (res.success) setStats(res); });
  }, []);

  const t = stats?.totals;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-700">إدارة المشاريع</h1>
          <p className="text-ink-soft text-sm mt-1">القسم الرابع — القلب الرئيسي للنظام. إدارة كل المشاريع الهندسية من الإنشاء حتى الإغلاق.</p>
        </div>
        <div className="flex items-center gap-2">
          <NotificationsBell />
          <ActorBar />
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Link href="/dashboard/pm/projects" className="rounded-md bg-navy-700 text-white text-sm font-medium px-4 py-2 hover:bg-navy-800 transition-colors">مشروع جديد / كل المشاريع</Link>
        <Link href="/dashboard/pm/resources" className="rounded-md border border-line bg-white text-sm font-medium px-4 py-2 hover:border-navy-300 transition-colors">مستودع الموارد</Link>
        <Link href="/dashboard/pm/reports" className="rounded-md border border-line bg-white text-sm font-medium px-4 py-2 hover:border-navy-300 transition-colors">مركز التقارير</Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard icon={FolderKanban} label="إجمالي المشاريع" value={t?.totalProjects ?? '—'} />
        <StatCard icon={PlayCircle} label="نشطة" value={t?.activeProjects ?? '—'} />
        <StatCard icon={CheckCircle2} label="مكتملة" value={t?.completedProjects ?? '—'} tone="pass" />
        <StatCard icon={PauseCircle} label="متوقفة" value={t?.stoppedProjects ?? '—'} tone="warn" />
        <StatCard icon={AlertTriangle} label="متأخرة" value={t?.delayedProjects ?? '—'} tone="fail" />
        <StatCard icon={Clock} label="قيد التخطيط" value={t?.planningProjects ?? '—'} />
        <StatCard icon={Wallet} label="إجمالي الميزانيات" value={t ? fmt(t.totalBudgets) : '—'} />
        <StatCard icon={TrendingDown} label="إجمالي المصروفات" value={t ? fmt(t.totalExpenses) : '—'} tone="fail" />
        <StatCard icon={TrendingUp} label="إجمالي الإيرادات" value={t ? fmt(t.totalRevenue) : '—'} tone="pass" />
        <StatCard icon={Activity} label="نسبة الإنجاز الكلية" value={t ? `${t.overallProgressPct}%` : '—'} />
        <StatCard icon={ListChecks} label="مهام مفتوحة / منجزة" value={t ? `${t.openTasks} / ${t.completedTasks}` : '—'} small />
        <StatCard icon={Users} label="مستخدمون عاملون" value={t?.activeUsers ?? '—'} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-sheet border border-line bg-white p-4">
          <h2 className="text-sm font-bold text-navy-700 mb-3">حالة المشاريع</h2>
          {stats?.statusChart?.some((s) => s.count > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={stats.statusChart.filter((s) => s.count > 0)} dataKey="count" nameKey="status" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {stats.statusChart.filter((s) => s.count > 0).map((s) => <Cell key={s.status} fill={STATUS_COLORS[s.status] || '#8B9296'} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [v, STATUS_LABELS[n] || n]} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-ink-soft text-center py-10">لا توجد بيانات كافية بعد.</p>}
        </div>

        <div className="rounded-sheet border border-line bg-white p-4">
          <h2 className="text-sm font-bold text-navy-700 mb-3">المصروفات والإيرادات شهرياً</h2>
          {stats?.cashFlowByMonth?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={stats.cashFlowByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#DBDDD8" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="expenses" name="مصروفات" stroke="#B23A32" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="revenue" name="إيرادات" stroke="#2F7A4F" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-ink-soft text-center py-10">لا توجد بيانات مالية كافية بعد.</p>}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-sheet border border-line bg-white p-4">
          <h2 className="text-sm font-bold text-navy-700 mb-3">آخر الأنشطة</h2>
          {stats?.recentActivity?.length > 0 ? (
            <div className="divide-y divide-line">
              {stats.recentActivity.map((a) => (
                <div key={a.id} className="py-2 text-xs flex items-center justify-between gap-2">
                  <span className="text-ink truncate">{ACTION_LABELS[a.action] || a.action} — {a.entity_type}</span>
                  <span className="text-ink-soft font-mono tabular-figure shrink-0" dir="ltr">{formatDate(a.created_at)}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-ink-soft py-4 text-center">لا يوجد نشاط بعد.</p>}
        </div>

        <div className="rounded-sheet border border-line bg-white p-4">
          <h2 className="text-sm font-bold text-navy-700 mb-3 flex items-center gap-1.5"><FileBarChart size={14} /> آخر التقارير</h2>
          {stats?.recentReports?.length > 0 ? (
            <div className="divide-y divide-line">
              {stats.recentReports.map((r) => (
                <div key={r.id} className="py-2 text-xs flex items-center justify-between gap-2">
                  <span className="text-ink truncate">{r.project_name} — {r.report_type}</span>
                  <span className="text-ink-soft font-mono tabular-figure shrink-0" dir="ltr">{formatDate(r.created_at)}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-ink-soft py-4 text-center">لم يُولَّد أي تقرير بعد.</p>}
        </div>
      </div>

      {stats?.projectsTimeline?.length > 0 && (
        <div className="rounded-sheet border border-line bg-white p-4">
          <h2 className="text-sm font-bold text-navy-700 mb-3">التقويم الزمني للمشاريع</h2>
          <div className="space-y-2">
            {stats.projectsTimeline.map((p) => (
              <Link key={p.id} href={`/dashboard/pm/projects/${p.id}`} className="flex items-center gap-3 text-xs hover:bg-paper rounded-md px-2 py-1.5 -mx-2 transition-colors">
                <span className="flex-1 text-ink font-medium truncate">{p.name}</span>
                <ProjectStatusBadge status={p.status} />
                <span className="text-ink-soft font-mono tabular-figure w-40 text-left" dir="ltr">{p.start_date || '—'} → {p.end_date || '—'}</span>
                <ArrowLeft size={13} className="text-concrete-300" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const ACTION_LABELS = { create: 'إنشاء', update: 'تعديل', delete: 'حذف', status_change: 'تغيير حالة', approve: 'اعتماد', reject: 'رفض', archive: 'أرشفة', new_version: 'إصدار جديد' };

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}
function formatDate(s) {
  if (!s) return '';
  try { return new Date(s + 'Z').toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' }); } catch { return s; }
}
