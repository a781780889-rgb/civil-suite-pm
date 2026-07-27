'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, Layers, Grid, Columns3, Rows3, Square, BrickWall, MoveUp, Database, Waves, Package, FileText, HardHat, X,
  LayoutDashboard, GitCommitVertical, Coins, ClipboardList, Upload, FileSpreadsheet, Sparkles, FolderKanban, Boxes, FileBarChart,
  CalendarDays, CalendarRange,
  Users, Target, Receipt, FileSignature, Truck, ClipboardCheck, Mail, CalendarClock, AlertTriangle, PieChart,
} from 'lucide-react';

const GROUPS = [
  {
    title: 'القسم الأول — حاسبة الخرسانة',
    items: [
      { href: '/dashboard', sheet: 'S1-00', label: 'الرئيسية', icon: Home, exact: true },
      { href: '/dashboard/footings', sheet: 'S1-01', label: 'القواعد', icon: Layers },
      { href: '/dashboard/mat', sheet: 'S1-02', label: 'اللبشة', icon: Grid },
      { href: '/dashboard/columns', sheet: 'S1-03', label: 'الأعمدة', icon: Columns3 },
      { href: '/dashboard/beams', sheet: 'S1-04', label: 'الكمرات', icon: Rows3 },
      { href: '/dashboard/slabs', sheet: 'S1-05', label: 'البلاطات', icon: Square },
      { href: '/dashboard/walls', sheet: 'S1-06', label: 'الجدران', icon: BrickWall },
      { href: '/dashboard/stairs', sheet: 'S1-07', label: 'السلالم', icon: MoveUp },
      { href: '/dashboard/tanks', sheet: 'S1-08', label: 'الخزانات', icon: Database },
      { href: '/dashboard/pools', sheet: 'S1-09', label: 'المسابح', icon: Waves },
      { href: '/dashboard/materials', sheet: 'S1-10', label: 'حاسبة المواد', icon: Package },
      { href: '/dashboard/reports', sheet: 'S1-99', label: 'التقارير المحفوظة', icon: FileText },
    ],
  },
  {
    title: 'القسم الثاني — حديد التسليح',
    items: [
      { href: '/dashboard/rebar', sheet: 'S2-00', label: 'لوحة تحكم الحديد', icon: LayoutDashboard, exact: true },
      { href: '/dashboard/rebar/pads', sheet: 'S2-01', label: 'القواعد والقبعات والشريطية', icon: Layers },
      { href: '/dashboard/rebar/columns', sheet: 'S2-02', label: 'الأعمدة والخوازيق', icon: GitCommitVertical },
      { href: '/dashboard/rebar/beams', sheet: 'S2-03', label: 'الكمرات والميدات والجسور', icon: Rows3 },
      { href: '/dashboard/rebar/slabs', sheet: 'S2-04', label: 'البلاطات (مصمتة/هوردي)', icon: Square },
      { href: '/dashboard/rebar/walls', sheet: 'S2-05', label: 'الجدران', icon: BrickWall },
      { href: '/dashboard/rebar/tanks', sheet: 'S2-06', label: 'الخزانات', icon: Database },
      { href: '/dashboard/rebar/pools', sheet: 'S2-07', label: 'المسابح', icon: Waves },
      { href: '/dashboard/rebar/stairs', sheet: 'S2-08', label: 'السلالم', icon: MoveUp },
      { href: '/dashboard/rebar/prices', sheet: 'S2-09', label: 'مكتبة الأسعار', icon: Coins },
    ],
  },
  {
    title: 'القسم الثالث — حصر الكميات',
    items: [
      { href: '/dashboard/boq', sheet: 'S3-00', label: 'لوحة تحكم الحصر', icon: LayoutDashboard, exact: true },
      { href: '/dashboard/boq/elements', sheet: 'S3-01', label: 'عناصر المشروع', icon: ClipboardList },
      { href: '/dashboard/boq/import', sheet: 'S3-02', label: 'الاستيراد', icon: Upload },
      { href: '/dashboard/boq/prices', sheet: 'S3-03', label: 'مكتبة الأسعار', icon: Coins },
      { href: '/dashboard/boq/reports', sheet: 'S3-04', label: 'التقارير والتصدير', icon: FileSpreadsheet },
      { href: '/dashboard/boq/ai', sheet: 'S3-05', label: 'مساعد الذكاء الاصطناعي', icon: Sparkles },
    ],
  },
  {
    title: 'القسم الرابع — إدارة المشاريع',
    items: [
      { href: '/dashboard/pm', sheet: 'S4-00', label: 'لوحة تحكم المشاريع', icon: LayoutDashboard, exact: true },
      { href: '/dashboard/pm/projects', sheet: 'S4-01', label: 'المشاريع', icon: FolderKanban },
      { href: '/dashboard/pm/resources', sheet: 'S4-02', label: 'مستودع الموارد', icon: Boxes },
      { href: '/dashboard/pm/reports', sheet: 'S4-03', label: 'مركز التقارير', icon: FileBarChart },
    ],
  },
  {
    title: 'القسم الخامس — الجدول الزمني',
    items: [
      { href: '/dashboard/schedule', sheet: 'S5-00', label: 'لوحة تحكم الجدول الزمني', icon: CalendarDays, exact: true },
      { href: '/dashboard/schedule/schedules', sheet: 'S5-01', label: 'الجداول الزمنية', icon: CalendarRange },
    ],
  },
  {
    title: 'القسم السادس — إدارة الأعمال',
    items: [
      { href: '/dashboard/business', sheet: 'S6-00', label: 'لوحة تحكم الأعمال', icon: LayoutDashboard, exact: true },
      { href: '/dashboard/business/clients', sheet: 'S6-01', label: 'العملاء', icon: Users },
      { href: '/dashboard/business/opportunities', sheet: 'S6-02', label: 'الفرص التجارية', icon: Target },
      { href: '/dashboard/business/quotes', sheet: 'S6-03', label: 'عروض الأسعار', icon: Receipt },
      { href: '/dashboard/business/contracts', sheet: 'S6-04', label: 'العقود', icon: FileSignature },
      { href: '/dashboard/business/partners?type=contractor', sheet: 'S6-05', label: 'المقاولون', icon: HardHat },
      { href: '/dashboard/business/partners?type=supplier', sheet: 'S6-06', label: 'الموردون', icon: Truck },
      { href: '/dashboard/business/work-orders', sheet: 'S6-07', label: 'أوامر العمل', icon: ClipboardCheck },
      { href: '/dashboard/business/commitments', sheet: 'S6-08', label: 'الالتزامات', icon: AlertTriangle },
      { href: '/dashboard/business/correspondence', sheet: 'S6-09', label: 'المراسلات', icon: Mail },
      { href: '/dashboard/business/meetings', sheet: 'S6-10', label: 'الاجتماعات', icon: CalendarClock },
      { href: '/dashboard/business/reports', sheet: 'S6-11', label: 'التقارير', icon: PieChart },
      { href: '/dashboard/business/ai', sheet: 'S6-12', label: 'مساعد الذكاء الاصطناعي', icon: Sparkles },
    ],
  },
];

export default function Sidebar({ mobileOpen, onClose }) {
  const pathname = usePathname();

  function isActive(item) {
    const base = item.href.split('?')[0];
    return item.exact ? pathname === base : pathname?.startsWith(base);
  }

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 bg-navy-900/40 z-30 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed lg:sticky top-0 right-0 z-40 h-screen w-72 shrink-0 bg-navy-700 text-white flex flex-col transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-md bg-rebar-600 flex items-center justify-center">
              <HardHat size={18} />
            </div>
            <div>
              <div className="font-bold text-sm leading-tight">Civil Suite</div>
              <div className="text-[11px] text-navy-200 leading-tight">منصة الهندسة المدنية المتكاملة</div>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-navy-200 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <div className="px-2 pb-1.5 text-[10px] font-bold text-navy-300 uppercase tracking-wide">{group.title}</div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                        active ? 'bg-white text-navy-700 font-bold shadow-sm' : 'text-navy-100 hover:bg-white/10'
                      }`}
                    >
                      <span
                        className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          active ? 'bg-navy-700 text-white' : 'bg-white/10 text-navy-200'
                        }`}
                        dir="ltr"
                      >
                        {item.sheet}
                      </span>
                      <Icon size={16} className={active ? 'text-navy-600' : 'text-navy-300'} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-white/10 text-[11px] text-navy-300 leading-relaxed shrink-0">
          Civil Engineering Suite © {new Date().getFullYear()}
        </div>
      </aside>
    </>
  );
}
