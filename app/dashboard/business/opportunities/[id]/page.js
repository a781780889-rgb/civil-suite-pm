'use client';
import { useEffect, useState, use as usePromise } from 'react';
import Link from 'next/link';
import { ArrowRight, Edit2, Sparkles, Receipt } from 'lucide-react';
import StatusBadge from '@/components/business/StatusBadge.jsx';
import OpportunityFormModal from '@/components/business/OpportunityFormModal.jsx';
import AiAssistantDrawer from '@/components/business/AiAssistantDrawer.jsx';
import { getOpportunity, listQuotes } from '@/lib/businessApi.js';

export default function OpportunityDetailPage({ params }) {
  const { id } = usePromise(params);
  const [opp, setOpp] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [editOpen, setEditOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  async function load() {
    const o = (await getOpportunity(id)).opportunity;
    setOpp(o);
    setQuotes((await listQuotes({ opportunity_id: id, pageSize: 50 })).rows);
  }
  useEffect(() => { load(); }, [id]);

  if (!opp) return <div className="p-6 text-sm text-ink-soft">جارٍ التحميل...</div>;

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <Link href="/dashboard/business/opportunities" className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink"><ArrowRight size={14} /> الفرص التجارية</Link>

      <div className="bg-white border border-line rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><h1 className="text-xl font-bold text-ink">{opp.name}</h1><StatusBadge status={opp.stage} /></div>
            <Link href={`/dashboard/business/clients/${opp.client_id}`} className="text-sm text-navy hover:underline mt-1 inline-block">{opp.client_name}</Link>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setAiOpen(true)} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-md bg-navy/10 text-navy hover:bg-navy/20"><Sparkles size={14} /> توقّع احتمالية الفوز</button>
            <button onClick={() => setEditOpen(true)} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-md border border-line hover:bg-line/50"><Edit2 size={14} /> تعديل</button>
          </div>
        </div>
        <div className="grid sm:grid-cols-4 gap-3 mt-4 text-sm">
          <Info label="القيمة المتوقعة" value={`${opp.expected_value?.toLocaleString('ar-SA')} ${opp.currency}`} />
          <Info label="احتمالية الفوز" value={`%${opp.win_probability}`} />
          <Info label="المصدر" value={opp.source || '—'} />
          <Info label="المسؤول" value={opp.responsible || '—'} />
          <Info label="تاريخ الفرصة" value={opp.opp_date || '—'} />
          <Info label="الإغلاق المتوقع" value={opp.expected_close_date || '—'} />
          {opp.stage === 'lost' && <Info label="سبب الخسارة" value={opp.lost_reason || '—'} />}
        </div>
        {opp.notes && <p className="mt-3 text-sm text-ink-soft bg-line/30 rounded-md px-3 py-2">{opp.notes}</p>}
      </div>

      <div className="bg-white border border-line rounded-lg">
        <div className="px-4 py-3 border-b border-line flex items-center justify-between">
          <h3 className="font-bold text-sm text-ink">عروض الأسعار المرتبطة</h3>
          <Link href={`/dashboard/business/quotes?opportunity_id=${id}`} className="text-xs text-navy hover:underline">إنشاء عرض سعر جديد ←</Link>
        </div>
        {quotes.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-ink-soft">لا توجد عروض أسعار بعد</div>
        ) : (
          <div className="divide-y divide-line">
            {quotes.map((q) => (
              <Link key={q.id} href={`/dashboard/business/quotes/${q.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-line/40">
                <span className="flex items-center gap-2 text-sm text-ink"><Receipt size={14} className="text-ink-soft" /> {q.title}</span>
                <div className="flex items-center gap-3"><span className="text-xs font-mono text-ink-soft">{q.total?.toLocaleString('ar-SA')}</span><StatusBadge status={q.status} /></div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <OpportunityFormModal open={editOpen} onClose={() => setEditOpen(false)} opportunity={opp} onSaved={() => { setEditOpen(false); load(); }} />
      <AiAssistantDrawer
        open={aiOpen} onClose={() => setAiOpen(false)} context={{ opportunity: opp }}
        quickActions={[{ label: 'تحليل الفرصة وتوقّع الفوز', action: 'opportunity-analysis', payload: { opportunity: opp, client: { name: opp.client_name }, historicalOpportunities: [] } }]}
      />
    </div>
  );
}

function Info({ label, value }) {
  return <div><div className="text-xs text-ink-soft">{label}</div><div className="text-ink font-medium">{value}</div></div>;
}
