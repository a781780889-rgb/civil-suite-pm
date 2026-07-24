'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardList, Upload, Coins, FileSpreadsheet, Sparkles, Boxes, Wallet, FolderKanban, ArrowLeft } from 'lucide-react';
import { fetchBoqDashboardStats } from '@/lib/api.js';
import { TRADES } from '@/lib/boq/categoryRegistry.js';
import ProjectPicker, { useSelectedProject } from '@/components/boq/ProjectPicker.jsx';

const TOOLS = [
  { href: '/dashboard/boq/elements', sheet: 'S3-01', label: 'عناصر المشروع', icon: ClipboardList, desc: 'إضافة وتعديل ومتابعة كل عناصر حصر الكميات' },
  { href: '/dashboard/boq/import', sheet: 'S3-02', label: 'الاستيراد', icon: Upload, desc: 'Excel / CSV / DXF / IFC' },
  { href: '/dashboard/boq/prices', sheet: 'S3-03', label: 'مكتبة الأسعار', icon: Coins, desc: 'أسعار المواد والعمالة والمعدات لكل تخصص' },
  { href: '/dashboard/boq/reports', sheet: 'S3-04', label: 'التقارير والتصدير', icon: FileSpreadsheet, desc: 'BOQ كامل، PDF / Excel / CSV' },
  { href: '/dashboard/boq/ai', sheet: 'S3-05', label: 'مساعد الذكاء الاصطناعي', icon: Sparkles, desc: 'اقتراحات أولية من صور المخططات' },
];

export default function BoqDashboardHome() {
  const { projects, projectId, select, addProject } = useSelectedProject();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchBoqDashboardStats(projectId || undefined).then((res) => { if (res.success) setStats(res.stats); });
  }, [projectId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-700">لوحة تحكم حصر الكميات</h1>
          <p className="text-ink-soft text-sm mt-1">القسم الثالث — نظام حصر الكميات (Quantity Takeoff)</p>
        </div>
        <ProjectPicker projects={projects} projectId={projectId} onSelect={select} onCreate={addProject} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard icon={Boxes} label="عدد العناصر" value={stats ? stats.totalElements.toLocaleString('en-US') : '—'} />
        <StatCard icon={Wallet} label="التكلفة الإجمالية" value={stats ? `${stats.totalCost.toLocaleString('en-US')} ريال` : '—'} />
        <StatCard icon={FolderKanban} label="المشاريع النشطة" value={stats ? stats.projectsWithElements.toLocaleString('en-US') : '—'} />
      </div>

      {stats?.byTrade?.length > 0 && (
        <div className="rounded-sheet border border-line bg-white p-4">
          <h2 className="text-sm font-bold text-navy-700 mb-3">توزيع التكلفة حسب التخصص</h2>
          <div className="space-y-2">
            {stats.byTrade.map((t) => {
              const max = stats.byTrade[0].cost || 1;
              return (
                <div key={t.trade} className="flex items-center gap-3">
                  <span className="text-xs w-32 shrink-0 text-ink-soft truncate">{TRADES[t.trade]?.label_ar || t.trade}</span>
                  <div className="flex-1 h-5 bg-concrete-100 rounded overflow-hidden">
                    <div className="h-full bg-navy-500" style={{ width: `${(t.cost / max) * 100}%` }} />
                  </div>
                  <span className="font-mono text-xs w-28 text-left text-ink tabular-figure" dir="ltr">{t.cost.toLocaleString('en-US')} ريال</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-bold text-navy-700 mb-3">أدوات حصر الكميات</h2>
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
          <h2 className="text-sm font-bold text-navy-700 mb-3">آخر العناصر المُضافة</h2>
          <div className="divide-y divide-line">
            {stats.recent.map((r) => (
              <div key={r.id} className="py-2.5 flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-ink">{r.category_name_ar}</span>
                  <span className="text-ink-soft"> — {r.name}</span>
                </div>
                <span className="font-mono text-xs text-ink-soft tabular-figure" dir="ltr">
                  {r.quantity_with_waste} {r.unit === 'm3' ? 'م³' : r.unit === 'm2' ? 'م²' : r.unit === 'm' ? 'م' : r.unit === 'kg' ? 'كغم' : 'عدد'}
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
