'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Truck, Wrench, AlertTriangle, Fuel, Clock, DollarSign, Gauge, CalendarClock, ArrowLeft,
} from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { StatCard, Section } from '@/components/pm/Shared.jsx';
import ActorBar from '@/components/pm/ActorBar.jsx';
import NotificationsBell from '@/components/equipment/NotificationsBell.jsx';
import AiAssistantDrawer from '@/components/equipment/AiAssistantDrawer.jsx';
import { getDashboardStats } from '@/lib/equipmentApi.js';

const PIE_COLORS = ['#1e3a5f', '#c4622d', '#3b7a57', '#b8860b', '#6b7280', '#8b5cf6', '#0891b2', '#be123c'];

export default function EquipmentDashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    getDashboardStats().then((res) => setStats(res.stats)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-sm text-ink-soft">جارِ التحميل...</div>;
  if (!stats) return <div className="p-6 text-sm text-fail">تعذّر تحميل بيانات لوحة التحكم.</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">إدارة المعدات</h1>
          <p className="text-xs text-ink-soft">القسم السابع — نظرة عامة على أسطول المعدات</p>
        </div>
        <div className="flex items-center gap-2">
          <NotificationsBell />
          <ActorBar />
          <button onClick={() => setAiOpen(true)} className="text-sm font-medium px-3 py-2 rounded-md bg-navy text-white hover:bg-navy-600">ملخص ذكي</button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap text-sm">
        <Link href="/dashboard/equipment/equipment" className="px-3 py-1.5 rounded-full bg-navy/10 text-navy font-medium hover:bg-navy/20">سجل المعدات</Link>
        <Link href="/dashboard/equipment/reservations" className="px-3 py-1.5 rounded-full border border-line text-ink-soft hover:bg-line/50">الحجز والتخصيص</Link>
        <Link href="/dashboard/equipment/maintenance" className="px-3 py-1.5 rounded-full border border-line text-ink-soft hover:bg-line/50">الصيانة</Link>
        <Link href="/dashboard/equipment/breakdowns" className="px-3 py-1.5 rounded-full border border-line text-ink-soft hover:bg-line/50">الأعطال</Link>
        <Link href="/dashboard/equipment/operators" className="px-3 py-1.5 rounded-full border border-line text-ink-soft hover:bg-line/50">المشغلون</Link>
        <Link href="/dashboard/equipment/spare-parts" className="px-3 py-1.5 rounded-full border border-line text-ink-soft hover:bg-line/50">قطع الغيار</Link>
        <Link href="/dashboard/equipment/rentals" className="px-3 py-1.5 rounded-full border border-line text-ink-soft hover:bg-line/50">المعدات المؤجرة</Link>
        <Link href="/dashboard/equipment/reports" className="px-3 py-1.5 rounded-full border border-line text-ink-soft hover:bg-line/50">التقارير</Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Truck} label="إجمالي المعدات" value={stats.total_equipment} />
        <StatCard icon={Gauge} label="قيد التشغيل" value={stats.working_equipment} tone="pass" />
        <StatCard icon={Wrench} label="في الصيانة" value={stats.maintenance_equipment} tone="warn" />
        <StatCard icon={AlertTriangle} label="أعطال مفتوحة" value={stats.open_breakdown_count} tone={stats.open_breakdown_count > 0 ? 'fail' : 'navy'} />
        <StatCard icon={Clock} label="إجمالي ساعات التشغيل" value={stats.total_operating_hours} small />
        <StatCard icon={Fuel} label="معدل استهلاك الوقود" value={`${stats.avg_fuel_rate_l_per_hour} ل/س`} small />
        <StatCard icon={DollarSign} label="تكلفة التشغيل" value={stats.total_operating_cost} small />
        <StatCard icon={DollarSign} label="تكلفة الصيانة" value={stats.total_maintenance_cost} small />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="ساعات التشغيل الشهرية (آخر 6 أشهر)">
          {stats.monthly_hours_chart?.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.monthly_hours_chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="ym" fontSize={11} /><YAxis fontSize={11} /><Tooltip />
                <Bar dataKey="hours" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-ink-soft py-8 text-center">لا توجد بيانات كافية بعد</p>}
        </Section>
        <Section title="التكاليف الشهرية (آخر 6 أشهر)">
          {stats.monthly_cost_chart?.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={stats.monthly_cost_chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="ym" fontSize={11} /><YAxis fontSize={11} /><Tooltip />
                <Line type="monotone" dataKey="cost" stroke="#c4622d" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-ink-soft py-8 text-center">لا توجد بيانات كافية بعد</p>}
        </Section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Section title="المعدات حسب النوع">
          {stats.by_category_group?.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={stats.by_category_group} dataKey="n" nameKey="group_label_ar" cx="50%" cy="50%" outerRadius={70} label={(e) => e.group_label_ar}>
                  {stats.by_category_group.map((entry, i) => <Cell key={entry.group_key || i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-ink-soft py-8 text-center">لا توجد بيانات</p>}
        </Section>

        <Section title="صيانة قادمة">
          {stats.upcoming_maintenance?.length ? (
            <ul className="space-y-2">
              {stats.upcoming_maintenance.map((s) => (
                <li key={s.id} className="flex items-start gap-2 text-sm">
                  <CalendarClock size={14} className="text-warnclr mt-0.5 shrink-0" />
                  <div><span className="font-medium text-ink">{s.equipment_name}</span> — {s.title}
                    <div className="text-xs text-ink-soft">{s.next_due_date || `عند ${s.next_due_hour_meter} ساعة`}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-ink-soft py-4 text-center">لا توجد صيانة مستحقة قريباً</p>}
        </Section>

        <Section title="آخر الأعطال">
          {stats.recent_breakdowns?.length ? (
            <ul className="space-y-2">
              {stats.recent_breakdowns.map((b) => (
                <li key={b.id} className="text-sm">
                  <span className="font-medium text-ink">{b.equipment_name}</span>
                  <p className="text-xs text-ink-soft line-clamp-1">{b.description}</p>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-ink-soft py-4 text-center">لا توجد أعطال مسجّلة</p>}
        </Section>
      </div>

      <Section title="آخر عمليات التشغيل" action={<Link href="/dashboard/equipment/equipment" className="text-xs text-navy flex items-center gap-1">عرض الكل <ArrowLeft size={12} /></Link>}>
        {stats.recent_operations?.length ? (
          <div className="space-y-1.5">
            {stats.recent_operations.map((o) => (
              <div key={o.id} className="flex items-center justify-between text-sm py-1 border-b border-line last:border-0">
                <span className="text-ink">{o.equipment_name} — {o.activity || 'تشغيل'}</span>
                <span className="text-ink-soft text-xs">{o.log_date} · {o.hours} س</span>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-ink-soft py-4 text-center">لا توجد عمليات تشغيل مسجّلة بعد</p>}
      </Section>

      <AiAssistantDrawer open={aiOpen} onClose={() => setAiOpen(false)} quickActions={[{ label: 'الملخص التنفيذي للأسطول', action: 'executive-summary' }]} />
    </div>
  );
}
