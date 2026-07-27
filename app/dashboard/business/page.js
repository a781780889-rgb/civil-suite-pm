'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users, Target, Receipt, FileSignature, TrendingUp, AlertTriangle, Sparkles, Loader2,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { StatCard, Section } from '@/components/pm/Shared.jsx';
import ActorBar from '@/components/pm/ActorBar.jsx';
import NotificationsBell from '@/components/business/NotificationsBell.jsx';
import AiAssistantDrawer from '@/components/business/AiAssistantDrawer.jsx';
import { getDashboardStats } from '@/lib/businessApi.js';

const PIE_COLORS = ['#1e3a5f', '#2f855a', '#c05621', '#b91c1c', '#6b7280', '#7c3aed'];

function fmt(n) {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('ar-SA').format(Math.round(n));
}

export default function BusinessDashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    getDashboardStats().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="p-6 text-fail text-sm">{error}</div>;
  if (!data) return <div className="p-6 flex items-center gap-2 text-ink-soft text-sm"><Loader2 className="animate-spin" size={16} /> جارٍ التحميل...</div>;

  const { stats, kpis } = data;
  const contractsChart = (stats.contracts.byStatus || []).map((r) => ({ name: statusAr(r.status), value: r.value }));
  const partnersChart = Object.entries(stats.partners || {}).map(([type, n]) => ({ name: type === 'contractor' ? 'مقاولون' : 'موردون', value: n }));

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">لوحة تحكم إدارة الأعمال</h1>
          <p className="text-sm text-ink-soft mt-0.5">القسم السادس — نظرة شاملة على العملاء والفرص والعقود والمالية التجارية</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAiOpen(true)} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-md bg-navy text-white hover:bg-navy-600 transition-colors">
            <Sparkles size={15} /> ملخص تنفيذي ذكي
          </button>
          <NotificationsBell />
          <ActorBar />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {kpis.map((k) => (
          <StatCard key={k.key} icon={iconFor(k.key)} label={k.label} value={typeof k.value === 'number' ? fmt(k.value) : k.value} tone={toneFor(k.key)} small />
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Section title="قيمة العقود حسب الحالة" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={contractsChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip formatter={(v) => fmt(v)} />
              <Bar dataKey="value" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Section>
        <Section title="الشركاء النشطون">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={partnersChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {partnersChart.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Section>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <QuickLinksCard stats={stats} />
        <Section title="آخر العمليات" className="lg:col-span-2">
          <div className="divide-y divide-line max-h-72 overflow-y-auto">
            {stats.recentActivity.length === 0 && <div className="text-sm text-ink-soft py-4 text-center">لا توجد عمليات مسجّلة بعد</div>}
            {stats.recentActivity.map((a, i) => (
              <div key={i} className="py-2.5 flex items-center justify-between text-sm">
                <span className="text-ink">{actionAr(a.action)} — {entityAr(a.entity_type)} #{a.entity_id}</span>
                <span className="text-xs text-ink-soft" dir="ltr">{a.created_at}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <AiAssistantDrawer
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        context={{ dashboardStats: stats }}
        quickActions={[{ label: 'إنشاء ملخص تنفيذي', action: 'executive-summary', payload: { dashboardStats: stats } }]}
      />
    </div>
  );
}

function QuickLinksCard({ stats }) {
  const links = [
    { href: '/dashboard/business/clients', label: 'العملاء', icon: Users, badge: stats.clients },
    { href: '/dashboard/business/opportunities', label: 'الفرص المفتوحة', icon: Target, badge: stats.opportunities.open },
    { href: '/dashboard/business/quotes', label: 'عروض الأسعار النشطة', icon: Receipt, badge: stats.quotes.active },
    { href: '/dashboard/business/contracts', label: 'العقود النشطة', icon: FileSignature, badge: stats.contracts.activeCount },
    { href: '/dashboard/business/commitments', label: 'الالتزامات المتأخرة', icon: AlertTriangle, badge: stats.commitments.overdue, danger: true },
  ];
  return (
    <Section title="اختصارات سريعة">
      <div className="space-y-1.5">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-line/60 transition-colors">
            <span className="flex items-center gap-2 text-sm text-ink"><l.icon size={16} className="text-ink-soft" /> {l.label}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${l.danger && l.badge > 0 ? 'bg-fail/15 text-fail' : 'bg-navy/10 text-navy'}`}>{l.badge}</span>
          </Link>
        ))}
      </div>
    </Section>
  );
}

function iconFor(key) {
  return { clients: Users, opportunities: Target, win_rate: TrendingUp, contracts_value: FileSignature, pipeline_value: Target, revenue_ytd: TrendingUp, pending_dues: Receipt, active_contracts: FileSignature, expiring_contracts: AlertTriangle, overdue_commitments: AlertTriangle }[key] || TrendingUp;
}
function toneFor(key) {
  if (key === 'overdue_commitments' || key === 'expiring_contracts') return 'fail';
  if (key === 'revenue_ytd' || key === 'win_rate') return 'pass';
  return 'navy';
}
function statusAr(s) {
  return { draft: 'مسودة', under_review: 'قيد المراجعة', pending_approval: 'بانتظار الاعتماد', active: 'نشط', completed: 'مكتمل', terminated: 'مُنهى', cancelled: 'ملغي' }[s] || s;
}
function actionAr(a) {
  return { create: 'إنشاء', update: 'تعديل', delete: 'حذف', status_change: 'تغيير حالة', approve: 'اعتماد', reject: 'رفض', submit: 'تقديم', create_from_quote: 'تحويل إلى عقد', mark_paid: 'تسجيل صرف', value_change_via_co: 'تحديث قيمة عقد' }[a] || a;
}
function entityAr(e) {
  return { client: 'عميل', opportunity: 'فرصة', quote: 'عرض سعر', contract: 'عقد', change_order: 'أمر تغيير', progress_payment: 'مستخلص', partner: 'شريك', work_order: 'أمر عمل', correspondence: 'مراسلة', meeting: 'اجتماع', commitment: 'التزام', document: 'مستند' }[e] || e;
}
