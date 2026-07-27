'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, ArrowLeft, X } from 'lucide-react';
import { EmptyState } from '@/components/pm/Shared.jsx';
import OpportunityFormModal from '@/components/business/OpportunityFormModal.jsx';
import { listOpenOpportunities, listOpportunities, changeOpportunityStage } from '@/lib/businessApi.js';

const STAGES = [
  { key: 'new', label: 'جديدة' }, { key: 'qualified', label: 'مؤهلة' }, { key: 'study', label: 'دراسة' },
  { key: 'quote', label: 'عرض سعر' }, { key: 'negotiation', label: 'تفاوض' },
];

export default function OpportunitiesPage() {
  const [open, setOpen] = useState([]);
  const [closed, setClosed] = useState({ won: [], lost: [] });
  const [showModal, setShowModal] = useState(false);
  const [lostTarget, setLostTarget] = useState(null);
  const [lostReason, setLostReason] = useState('');

  async function load() {
    const [pipeline, wonRes, lostRes] = await Promise.all([
      listOpenOpportunities(),
      listOpportunities({ stage: 'won', pageSize: 50 }),
      listOpportunities({ stage: 'lost', pageSize: 50 }),
    ]);
    setOpen(pipeline.opportunities || []);
    setClosed({ won: wonRes.rows, lost: lostRes.rows });
  }
  useEffect(() => { load(); }, []);

  async function advance(o) {
    const idx = STAGES.findIndex((s) => s.key === o.stage);
    if (idx < STAGES.length - 1) {
      await changeOpportunityStage(o.id, STAGES[idx + 1].key);
    } else {
      await changeOpportunityStage(o.id, 'won');
    }
    load();
  }

  async function markLost(e) {
    e.preventDefault();
    await changeOpportunityStage(lostTarget.id, 'lost', lostReason);
    setLostTarget(null); setLostReason('');
    load();
  }

  const totalPipelineValue = open.reduce((s, o) => s + (o.expected_value || 0), 0);

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">الفرص التجارية</h1>
          <p className="text-sm text-ink-soft mt-0.5">{open.length} فرصة مفتوحة بقيمة {totalPipelineValue.toLocaleString('ar-SA')} · فوز {closed.won.length} · خسارة {closed.lost.length}</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-md bg-navy text-white hover:bg-navy-600"><Plus size={16} /> فرصة جديدة</button>
      </div>

      {open.length === 0 && closed.won.length === 0 && closed.lost.length === 0 ? (
        <EmptyState title="لا توجد فرص بعد" message="ابدأ بتسجيل أول فرصة تجارية." />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {STAGES.map((stage) => (
            <div key={stage.key} className="w-64 shrink-0">
              <div className="text-xs font-bold text-ink-soft mb-2 px-1">{stage.label} ({open.filter((o) => o.stage === stage.key).length})</div>
              <div className="space-y-2">
                {open.filter((o) => o.stage === stage.key).map((o) => (
                  <div key={o.id} className="bg-white border border-line rounded-lg p-3">
                    <Link href={`/dashboard/business/opportunities/${o.id}`} className="text-sm font-medium text-ink hover:text-navy line-clamp-2">{o.name}</Link>
                    <div className="text-xs text-ink-soft mt-1">{o.client_name}</div>
                    <div className="text-xs font-mono text-navy mt-1">{o.expected_value?.toLocaleString('ar-SA')} · %{o.win_probability}</div>
                    <div className="flex gap-1.5 mt-2">
                      <button onClick={() => advance(o)} className="flex-1 flex items-center justify-center gap-1 text-[11px] font-medium py-1 rounded bg-pass/10 text-pass hover:bg-pass/20"><ArrowLeft size={11} /> تقديم</button>
                      <button onClick={() => setLostTarget(o)} className="text-[11px] font-medium py-1 px-2 rounded bg-fail/10 text-fail hover:bg-fail/20">خسارة</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <OpportunityFormModal open={showModal} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />

      {lostTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-navy-900/40" onClick={() => setLostTarget(null)} />
          <form onSubmit={markLost} className="relative w-full max-w-sm bg-white rounded-xl shadow-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-ink">سبب خسارة الفرصة</h3>
              <button type="button" onClick={() => setLostTarget(null)} className="text-ink-soft"><X size={16} /></button>
            </div>
            <textarea value={lostReason} onChange={(e) => setLostReason(e.target.value)} required rows={3} className="w-full rounded-md border border-line px-3 py-2 text-sm" placeholder="اذكر سبب الخسارة..." />
            <button type="submit" className="w-full text-sm font-medium py-2 rounded-md bg-fail text-white">تأكيد الخسارة</button>
          </form>
        </div>
      )}
    </div>
  );
}
