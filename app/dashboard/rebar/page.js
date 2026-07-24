'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Layers, GitCommitVertical, Rows3, Square, BrickWall, Database, Waves, MoveUp, Coins,
  Scale, Hash, Wallet, Percent, ArrowLeft,
} from 'lucide-react';
import { fetchRebarDashboardStats } from '@/lib/api.js';

const TOOLS = [
  { href: '/dashboard/rebar/pads', sheet: 'S2-01', label: 'القواعد والقبعات والشريطية', icon: Layers, desc: 'منفصلة، مشتركة، لبشة، قبعات، شريطية' },
  { href: '/dashboard/rebar/columns', sheet: 'S2-02', label: 'الأعمدة والخوازيق', icon: GitCommitVertical, desc: 'حديد طولي + كانات/حلزوني' },
  { href: '/dashboard/rebar/beams', sheet: 'S2-03', label: 'الكمرات والميدات والجسور', icon: Rows3, desc: 'حديد علوي/سفلي + كانات' },
  { href: '/dashboard/rebar/slabs', sheet: 'S2-04', label: 'البلاطات', icon: Square, desc: 'مصمتة وهوردي' },
  { href: '/dashboard/rebar/walls', sheet: 'S2-05', label: 'الجدران', icon: BrickWall, desc: 'مستقيمة ودائرية' },
  { href: '/dashboard/rebar/tanks', sheet: 'S2-06', label: 'الخزانات', icon: Database, desc: 'جدار + قاعدة + سقف' },
  { href: '/dashboard/rebar/pools', sheet: 'S2-07', label: 'المسابح', icon: Waves, desc: 'جدار + قاعدة' },
  { href: '/dashboard/rebar/stairs', sheet: 'S2-08', label: 'السلالم', icon: MoveUp, desc: 'حديد رئيسي وتوزيع' },
  { href: '/dashboard/rebar/prices', sheet: 'S2-09', label: 'مكتبة الأسعار', icon: Coins, desc: 'إدارة أسعار الحديد والتصنيع' },
];

const TYPE_LABELS = {
  rebar_isolated_footing: 'قواعد منفصلة', rebar_combined_footing: 'قواعد مشتركة', rebar_mat: 'لبشة', rebar_pile_cap: 'قبعات خوازيق',
  rebar_strip_footing: 'أساسات شريطية', rebar_column: 'أعمدة', rebar_pile: 'خوازيق', rebar_beam: 'كمرات', rebar_tie_beam: 'ميدات',
  rebar_girder: 'جسور', rebar_solid_slab: 'بلاطات مصمتة', rebar_hourdi_slab: 'بلاطات هوردي', rebar_wall: 'جدران', rebar_tank: 'خزانات',
  rebar_pool: 'مسابح', rebar_stairs: 'سلالم',
};

export default function RebarDashboardHome() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchRebarDashboardStats().then((res) => {
      if (res.success) setStats(res.stats);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-700">لوحة تحكم حديد التسليح</h1>
        <p className="text-ink-soft text-sm mt-1">القسم الثاني — حصر وتفصيل حديد التسليح (Bar Bending Schedule) لجميع العناصر الإنشائية</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Scale} label="إجمالي وزن الحديد" value={stats ? `${stats.totalWeightTon} طن` : '—'} />
        <StatCard icon={Hash} label="إجمالي عدد الأسياخ" value={stats?.totalBars ?? '—'} />
        <StatCard icon={Wallet} label="إجمالي التكلفة" value={stats ? `${stats.totalCost.toLocaleString('en-US')} ريال` : '—'} />
        <StatCard icon={Percent} label="متوسط نسبة الهدر" value={stats ? `${stats.avgWastePct}%` : '—'} />
      </div>

      {stats?.topDiameters?.length > 0 && (
        <div className="rounded-sheet border border-line bg-white p-4">
          <h2 className="text-sm font-bold text-navy-700 mb-3">أكثر الأقطار استخداماً (بالوزن)</h2>
          <div className="space-y-2">
            {stats.topDiameters.map((d) => {
              const max = stats.topDiameters[0].weightKg || 1;
              return (
                <div key={d.diameter} className="flex items-center gap-3">
                  <span className="font-mono text-xs w-14 text-ink-soft" dir="ltr">Ø{d.diameter}mm</span>
                  <div className="flex-1 h-5 bg-concrete-100 rounded overflow-hidden">
                    <div className="h-full bg-rebar-500" style={{ width: `${(d.weightKg / max) * 100}%` }} />
                  </div>
                  <span className="font-mono text-xs w-20 text-left text-ink" dir="ltr">{d.weightKg} kg</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-bold text-navy-700 mb-3">أدوات حاسبة حديد التسليح</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TOOLS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="group rounded-sheet border border-line bg-white p-4 hover:border-navy-400 hover:shadow-sheet transition-all flex items-start gap-3"
            >
              <div className="w-10 h-10 rounded-md bg-navy-50 text-navy-600 flex items-center justify-center shrink-0 group-hover:bg-navy-600 group-hover:text-white transition-colors">
                <t.icon size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold text-concrete-500" dir="ltr">{t.sheet}</span>
                  <span className="font-bold text-sm text-ink">{t.label}</span>
                </div>
                <p className="text-xs text-ink-soft mt-0.5">{t.desc}</p>
              </div>
              <ArrowLeft size={16} className="text-concrete-300 group-hover:text-navy-600 transition-colors shrink-0 mt-1" />
            </Link>
          ))}
        </div>
      </div>

      {stats?.recent?.length > 0 && (
        <div className="rounded-sheet border border-line bg-white p-4">
          <h2 className="text-sm font-bold text-navy-700 mb-3">آخر العمليات المنفذة</h2>
          <div className="divide-y divide-line">
            {stats.recent.map((r) => (
              <div key={r.id} className="py-2.5 flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-ink">{TYPE_LABELS[r.calc_type] || r.calc_type}</span>
                  {r.title && <span className="text-ink-soft"> — {r.title}</span>}
                </div>
                <span className="text-xs text-ink-soft font-mono tabular-figure" dir="ltr">
                  {new Date(r.created_at + 'Z').toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-sheet border border-line bg-white p-4">
      <div className="flex items-center gap-2 text-ink-soft mb-2">
        <Icon size={15} />
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-lg font-bold text-navy-700 font-mono tabular-figure">{value}</div>
    </div>
  );
}
