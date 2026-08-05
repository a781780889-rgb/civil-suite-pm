'use client';
import { useEffect, useState } from 'react';
import { Sparkles, DollarSign } from 'lucide-react';
import { Section, StatCard } from '@/components/pm/Shared.jsx';
import AiAssistantDrawer from '@/components/equipment/AiAssistantDrawer.jsx';
import { getEquipmentCostSummary } from '@/lib/equipmentApi.js';

const AI_QUICK_ACTIONS = [
  { label: 'احتمال العطل القادم', action: 'breakdown-risk' },
  { label: 'تحليل استهلاك الوقود', action: 'fuel-analysis' },
  { label: 'اقتراح جدول صيانة', action: 'maintenance-suggestion' },
  { label: 'مقارنة الكفاءة', action: 'efficiency-comparison' },
  { label: 'توقع التكلفة القادمة', action: 'cost-forecast' },
];

export default function CostsTab({ equipment }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    getEquipmentCostSummary(equipment.id).then((res) => setSummary(res.summary)).finally(() => setLoading(false));
  }, [equipment.id]);

  if (loading) return <p className="text-sm text-ink-soft">جارِ التحميل...</p>;
  if (!summary) return null;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setAiOpen(true)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-navy text-white hover:bg-navy-600">
          <Sparkles size={13} /> تحليل ذكي لهذه المعدة
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="التكلفة الإجمالية" value={summary.total_cost} icon={DollarSign} />
        <StatCard label="تكلفة الساعة التشغيلية" value={summary.cost_per_hour ?? '—'} small />
        <StatCard label="متوسط زمن الإصلاح MTTR" value={summary.mttr_hours != null ? `${summary.mttr_hours} س` : '—'} small />
        <StatCard label="متوسط الوقت بين الأعطال MTBF" value={summary.mtbf_hours != null ? `${summary.mtbf_hours} س` : '—'} small />
      </div>

      <Section title="تفصيل التكلفة">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <CostRow label="الوقود" value={summary.fuel_cost} />
          <CostRow label="الصيانة" value={summary.maintenance_cost} />
          <CostRow label="الأعطال" value={summary.breakdown_cost} />
          <CostRow label="الإيجار" value={summary.rental_cost} />
          <CostRow label="النقل" value={summary.transfer_cost} />
          <CostRow label="الإهلاك المتراكم" value={summary.depreciation?.accumulated_depreciation} />
        </div>
        {summary.depreciation && (
          <p className="text-xs text-ink-soft mt-3 pt-3 border-t border-line">
            القيمة الدفترية الحالية (بعد الإهلاك): {summary.depreciation.book_value} — الإهلاك السنوي: {summary.depreciation.annual_depreciation}
          </p>
        )}
      </Section>

      <AiAssistantDrawer open={aiOpen} onClose={() => setAiOpen(false)} equipmentId={equipment.id} quickActions={AI_QUICK_ACTIONS} />
    </div>
  );
}

function CostRow({ label, value }) {
  return (
    <div className="rounded-md border border-line px-3 py-2">
      <div className="text-xs text-ink-soft">{label}</div>
      <div className="text-sm font-bold text-ink font-mono">{value ?? 0}</div>
    </div>
  );
}
