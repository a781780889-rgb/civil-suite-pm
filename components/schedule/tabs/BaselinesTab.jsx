'use client';
import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, GitCompare } from 'lucide-react';
import { schBaselines } from '@/lib/scheduleApi.js';
import { Section, EmptyState, ConfirmDialog } from '@/components/pm/Shared.jsx';
import { TextField } from '@/components/ui/Field.jsx';

export default function BaselinesTab({ schedule }) {
  const [baselines, setBaselines] = useState([]);
  const [name, setName] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const load = useCallback(async () => {
    const res = await schBaselines.list(schedule.id);
    if (res.success) setBaselines(res.baselines);
  }, [schedule.id]);

  useEffect(() => { load(); }, [load]);

  async function create() {
    const res = await schBaselines.create(schedule.id, { name });
    if (res.success) { setName(''); load(); }
  }

  async function view(id) {
    setSelectedId(id);
    const res = await schBaselines.compare(id);
    if (res.success) setComparison(res);
  }

  async function remove(id) {
    await schBaselines.remove(id);
    setConfirmDeleteId(null);
    if (selectedId === id) { setSelectedId(null); setComparison(null); }
    load();
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-1 space-y-4">
        <Section title="إنشاء خط أساس جديد">
          <div className="flex gap-2">
            <TextField label="" value={name} onChange={setName} placeholder="اسم خط الأساس (اختياري)" />
          </div>
          <button onClick={create} className="mt-2 flex items-center gap-1.5 rounded-md bg-navy-600 hover:bg-navy-700 text-white text-sm font-medium px-4 py-2 w-full justify-center transition-colors">
            <Plus size={14} /> أخذ لقطة من الوضع الحالي
          </button>
        </Section>
        <Section title="خطوط الأساس المحفوظة">
          {baselines.length === 0 && <EmptyState title="لا خطوط أساس بعد" />}
          <div className="divide-y divide-line">
            {baselines.map((b) => (
              <button key={b.id} onClick={() => view(b.id)} className={`w-full text-right px-1 py-2 flex items-center justify-between text-sm hover:bg-paper transition-colors ${selectedId === b.id ? 'text-navy-700 font-bold' : 'text-ink'}`}>
                <span className="flex items-center gap-1.5 min-w-0"><GitCompare size={13} className="shrink-0 text-ink-soft" /> <span className="truncate">{b.name}</span></span>
                <Trash2 size={13} className="text-concrete-400 hover:text-fail-600 shrink-0" onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(b.id); }} />
              </button>
            ))}
          </div>
        </Section>
      </div>

      <div className="lg:col-span-2">
        {!comparison ? (
          <EmptyState title="اختر خط أساس للمقارنة" message="سيُعرض هنا الفرق بين تاريخ كل نشاط وقت أخذ الأساس والوضع الحالي." />
        ) : (
          <Section title={`مقارنة: ${comparison.baseline.name}`}>
            {comparison.newActivityIds.length > 0 && (
              <p className="text-xs text-navy-600 bg-navy-50 rounded-md px-2.5 py-1.5 mb-2">
                {comparison.newActivityIds.length} نشاط أُضيف بعد أخذ هذا الأساس.
              </p>
            )}
            <div className="overflow-x-auto -mx-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-ink-soft border-b border-line">
                    <th className="text-right font-medium px-4 py-1.5">النشاط</th>
                    <th className="text-right font-medium px-2 py-1.5">نهاية الأساس</th>
                    <th className="text-right font-medium px-2 py-1.5">النهاية الحالية</th>
                    <th className="text-right font-medium px-2 py-1.5">الانحراف</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.comparison.map((c) => (
                    <tr key={c.activity_id} className="border-b border-line/60">
                      <td className="px-4 py-1.5 truncate max-w-[180px]">{c.wbs_code} {c.name}{c.status === 'deleted' && <span className="text-fail-600"> (محذوف)</span>}</td>
                      <td className="px-2 py-1.5 font-mono" dir="ltr">{c.baseline_end || '—'}</td>
                      <td className="px-2 py-1.5 font-mono" dir="ltr">{c.current_end || '—'}</td>
                      <td className={`px-2 py-1.5 font-mono ${c.variance_days > 0 ? 'text-fail-700' : c.variance_days < 0 ? 'text-pass-700' : 'text-ink-soft'}`} dir="ltr">
                        {c.variance_days == null ? '—' : c.variance_days > 0 ? `+${c.variance_days}` : c.variance_days}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}
      </div>

      <ConfirmDialog open={confirmDeleteId != null} title="حذف خط الأساس؟" onConfirm={() => remove(confirmDeleteId)} onCancel={() => setConfirmDeleteId(null)} />
    </div>
  );
}
