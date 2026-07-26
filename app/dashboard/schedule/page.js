'use client';
// app/dashboard/schedule/page.js — لوحة تحكم القسم الخامس (الصفحة الرئيسية وفق المستند: عدد
// المشاريع/الجداول/الأنشطة، المنجزة/الجارية/المتأخرة/الحرجة، نسبة الإنجاز الكلية، الأيام
// المتبقية/المتأخرة، المسار الحرج، آخر التحديثات، رسوم بيانية، تقويم زمني تفاعلي).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays, ListChecks, Activity as ActivityIcon, CheckCircle2, AlertTriangle, Flame,
  Percent, Clock, Plus, ArrowLeft,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { schDashboard } from '@/lib/scheduleApi.js';
import { StatCard, Section, EmptyState } from '@/components/pm/Shared.jsx';
import ActorBar from '@/components/pm/ActorBar.jsx';
import NotificationsBell from '@/components/pm/NotificationsBell.jsx';
import MiniCalendar from '@/components/schedule/MiniCalendar.jsx';

const STATUS_COLORS = { 'مكتملة': '#2F7A4F', 'جارية': '#204A72', 'متأخرة': '#B23A32', 'لم تبدأ': '#8B9296' };

export default function ScheduleDashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await schDashboard.stats();
      if (res.success) setStats(res.stats);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-navy-800 flex items-center gap-2"><CalendarDays size={20} className="text-rebar-600" /> لوحة تحكم الجدول الزمني</h1>
          <p className="text-xs text-ink-soft mt-0.5">القسم الخامس — تخطيط ومتابعة الجداول الزمنية لكل المشاريع، بمنهجية CPM حقيقية.</p>
        </div>
        <div className="flex items-center gap-2">
          <NotificationsBell />
          <ActorBar />
          <Link href="/dashboard/schedule/schedules" className="flex items-center gap-1.5 rounded-md bg-navy-600 hover:bg-navy-700 text-white text-sm font-medium px-3 py-2 transition-colors">
            <Plus size={15} /> جدول جديد
          </Link>
        </div>
      </div>

      {loading && <div className="text-sm text-ink-soft">جارِ التحميل…</div>}

      {!loading && stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={FolderStatIcon} label="المشاريع بجداول زمنية" value={stats.totalProjectsWithSchedules} />
            <StatCard icon={CalendarDays} label="عدد الجداول الزمنية" value={stats.totalSchedules} />
            <StatCard icon={ListChecks} label="إجمالي الأنشطة" value={stats.totalActivities} />
            <StatCard icon={CheckCircle2} label="أنشطة منجزة" value={stats.completed} tone="pass" />
            <StatCard icon={ActivityIcon} label="أنشطة جارية" value={stats.inProgress} />
            <StatCard icon={AlertTriangle} label="أنشطة متأخرة" value={stats.delayedCount} tone={stats.delayedCount ? 'fail' : 'navy'} />
            <StatCard icon={Flame} label="أنشطة على المسار الحرج" value={stats.criticalCount} tone={stats.criticalCount ? 'warn' : 'navy'} />
            <StatCard icon={Percent} label="نسبة الإنجاز الكلية" value={`${stats.overallProgressPct}%`} tone="pass" />
            <StatCard icon={Clock} label="أقصى تأخر (أيام)" value={stats.maxDelayDays} tone={stats.maxDelayDays ? 'fail' : 'navy'} small />
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <Section title="توزيع حالة الأنشطة" className="lg:col-span-1">
              {stats.totalActivities === 0 ? (
                <EmptyState title="لا توجد أنشطة بعد" message="أنشئ جدولاً زمنياً وابدأ بإضافة الأنشطة." />
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stats.charts.summary} dataKey="value" nameKey="label" innerRadius={45} outerRadius={75} paddingAngle={2}>
                        {stats.charts.summary.map((entry) => (
                          <Cell key={entry.label} fill={STATUS_COLORS[entry.label] || '#8B9296'} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-3 mt-1">
                    {stats.charts.summary.map((e) => (
                      <span key={e.label} className="flex items-center gap-1.5 text-[11px] text-ink-soft">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: STATUS_COLORS[e.label] }} />
                        {e.label} ({e.value})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Section>

            <Section title="أنشطة حسب الحالة التفصيلية" className="lg:col-span-1">
              {stats.charts.statusDistribution.length === 0 ? (
                <EmptyState title="لا بيانات بعد" />
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.charts.statusDistribution} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#DBDDD8" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="status" width={70} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#16324F" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Section>

            <Section title="تقويم الأنشطة" className="lg:col-span-1">
              <MiniCalendar activities={stats.criticalPathActivities} />
            </Section>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Section title="المسار الحرج (أهم الأنشطة الحرجة)" action={<Flame size={14} className="text-rebar-600" />}>
              {stats.criticalPathActivities.length === 0 ? (
                <EmptyState title="لا أنشطة حرجة حالياً" message="سيظهر هنا كل نشاط ليس لديه أي هامش زمني (Total Float = 0)." />
              ) : (
                <ul className="divide-y divide-line -mx-4">
                  {stats.criticalPathActivities.slice(0, 10).map((a) => (
                    <li key={a.id} className="px-4 py-2 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[10px] text-ink-soft shrink-0">{a.wbs_code}</span>
                        <span className="truncate text-ink">{a.name}</span>
                      </span>
                      <span className="font-mono text-[11px] text-ink-soft shrink-0" dir="ltr">{a.planned_start} → {a.planned_end}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="آخر التحديثات">
              {stats.recentUpdates.length === 0 ? (
                <EmptyState title="لا تحديثات بعد" />
              ) : (
                <ul className="divide-y divide-line -mx-4">
                  {stats.recentUpdates.slice(0, 10).map((u) => (
                    <li key={u.id} className="px-4 py-2 text-sm">
                      <span className="text-ink">{actionLabel(u.action)} — {u.entity_type}</span>
                      <span className="block text-[11px] text-ink-soft mt-0.5">{u.project_name || ''} · {formatDateTime(u.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </>
      )}

      {!loading && stats && stats.totalSchedules === 0 && (
        <EmptyState
          title="لا توجد جداول زمنية بعد"
          message="أنشئ أول جدول زمني لأحد مشاريعك لبدء التخطيط بمنهجية المسار الحرج."
          action={
            <Link href="/dashboard/schedule/schedules" className="inline-flex items-center gap-1.5 text-navy-600 text-sm font-medium hover:underline">
              إنشاء جدول زمني <ArrowLeft size={14} />
            </Link>
          }
        />
      )}
    </div>
  );
}

function FolderStatIcon(props) {
  return <ListChecks {...props} />;
}

function actionLabel(action) {
  const map = {
    create: 'إنشاء', update: 'تعديل', delete: 'حذف', hard_delete: 'حذف نهائي',
    reorder_activities: 'إعادة ترتيب أنشطة', progress_update: 'تحديث تقدّم', set_primary: 'تعيين كجدول رئيسي',
  };
  return map[action] || action;
}

function formatDateTime(v) {
  if (!v) return '';
  try { return new Date(v.replace(' ', 'T') + 'Z').toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return v; }
}
