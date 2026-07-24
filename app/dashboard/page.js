'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Home, Layers, Grid, Columns3, Rows3, Square, BrickWall, MoveUp, Database, Waves, Package, FileText,
  Activity, FolderKanban, ArrowLeft,
} from 'lucide-react';
import { fetchDashboardStats } from '@/lib/api.js';

const TOOLS = [
  { href: '/dashboard/footings', sheet: 'S-01', label: 'القواعد المنفصلة والمشتركة والمرتبطة', icon: Layers, desc: 'منفصلة، مشتركة/شريطية، Strap' },
  { href: '/dashboard/mat', sheet: 'S-02', label: 'اللبشة', icon: Grid, desc: 'الطريقة الجاسئة لتوزيع الضغط' },
  { href: '/dashboard/columns', sheet: 'S-03', label: 'الأعمدة', icon: Columns3, desc: 'تصميم محوري ACI 318' },
  { href: '/dashboard/beams', sheet: 'S-04', label: 'الكمرات', icon: Rows3, desc: 'انحناء وقص وترخيم' },
  { href: '/dashboard/slabs', sheet: 'S-05', label: 'البلاطات', icon: Square, desc: 'أحادية وثنائية الاتجاه' },
  { href: '/dashboard/walls', sheet: 'S-06', label: 'الجدران الخرسانية', icon: BrickWall, desc: 'عادية واستنادية' },
  { href: '/dashboard/stairs', sheet: 'S-07', label: 'السلالم', icon: MoveUp, desc: 'مستقيم، L، U، دائري' },
  { href: '/dashboard/tanks', sheet: 'S-08', label: 'الخزانات', icon: Database, desc: 'مستطيلة ودائرية' },
  { href: '/dashboard/pools', sheet: 'S-09', label: 'المسابح', icon: Waves, desc: 'مستطيل، دائري، حر' },
  { href: '/dashboard/materials', sheet: 'S-10', label: 'حاسبة المواد السريعة', icon: Package, desc: 'أسمنت، رمل، بحص، تكلفة' },
];

const TYPE_LABELS = {
  isolated_footing: 'قواعد منفصلة', combined_footing: 'قواعد مشتركة/شريطية', strap_footing: 'قواعد مرتبطة',
  mat_foundation: 'لبشة', column: 'أعمدة', beam: 'كمرات', one_way_slab: 'بلاطات أحادية', two_way_slab: 'بلاطات ثنائية',
  wall: 'جدران', stairs: 'سلالم', tank: 'خزانات', pool: 'مسابح', materials_quick: 'مواد سريعة',
};

export default function DashboardHome() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchDashboardStats().then((res) => {
      if (res.success) setStats(res.stats);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-700">لوحة التحكم الرئيسية</h1>
        <p className="text-ink-soft text-sm mt-1">القسم الأول — حاسبة الخرسانة الهندسية. اختر الأداة المطلوبة من القائمة الجانبية أو من البطاقات أدناه.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Activity} label="إجمالي الحسابات المحفوظة" value={stats?.totalCalculations ?? '—'} />
        <StatCard icon={FolderKanban} label="عدد المشاريع" value={stats?.totalProjects ?? '—'} />
        <StatCard icon={Layers} label="أكثر عنصر تم حسابه" value={stats?.byType?.[0] ? TYPE_LABELS[stats.byType[0].calc_type] || stats.byType[0].calc_type : '—'} />
        <StatCard icon={Package} label="عدد أنواع العناصر المستخدمة" value={stats?.byType?.length ?? '—'} />
      </div>

      <div>
        <h2 className="text-sm font-bold text-navy-700 mb-3">أدوات الحساب</h2>
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
          <h2 className="text-sm font-bold text-navy-700 mb-3">آخر النشاطات</h2>
          <div className="divide-y divide-line">
            {stats.recent.map((r) => (
              <div key={r.id} className="py-2.5 flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-ink">{TYPE_LABELS[r.calc_type] || r.calc_type}</span>
                  {r.title && <span className="text-ink-soft"> — {r.title}</span>}
                </div>
                <span className="text-xs text-ink-soft font-mono tabular-figure" dir="ltr">
                  {new Date(r.created_at + 'Z').toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' })}
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
      <div className="text-xl font-bold text-navy-700 font-mono tabular-figure">{value}</div>
    </div>
  );
}
