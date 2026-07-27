'use client';
import { useEffect, useState, use as usePromise } from 'react';
import Link from 'next/link';
import { ArrowRight, Edit2, Plus, Sparkles } from 'lucide-react';
import StatusBadge from '@/components/business/StatusBadge.jsx';
import PartnerFormModal from '@/components/business/PartnerFormModal.jsx';
import AiAssistantDrawer from '@/components/business/AiAssistantDrawer.jsx';
import { getPartner, addPartnerEvaluation } from '@/lib/businessApi.js';

export default function PartnerDetailPage({ params }) {
  const { id } = usePromise(params);
  const [partner, setPartner] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [evalOpen, setEvalOpen] = useState(false);
  const [ev, setEv] = useState({ quality: 3, schedule_adherence: 3, cost: 3, safety: 3, overall_notes: '' });

  async function load() { setPartner((await getPartner(id)).partner); }
  useEffect(() => { load(); }, [id]);

  async function submitEval(e) {
    e.preventDefault();
    await addPartnerEvaluation(id, ev);
    setEv({ quality: 3, schedule_adherence: 3, cost: 3, safety: 3, overall_notes: '' });
    setEvalOpen(false);
    load();
  }

  if (!partner) return <div className="p-6 text-sm text-ink-soft">جارٍ التحميل...</div>;
  const backHref = `/dashboard/business/partners?type=${partner.partner_type}`;

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink"><ArrowRight size={14} /> {partner.partner_type === 'supplier' ? 'الموردون' : 'المقاولون'}</Link>

      <div className="bg-white border border-line rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><h1 className="text-xl font-bold text-ink">{partner.company_name}</h1><StatusBadge status={partner.status} /></div>
            <div className="text-sm text-ink-soft mt-1">{partner.specialty || partner.materials_services || '—'}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setAiOpen(true)} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-md bg-navy/10 text-navy hover:bg-navy/20"><Sparkles size={14} /> تحليل الأداء</button>
            <button onClick={() => setEditOpen(true)} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-md border border-line hover:bg-line/50"><Edit2 size={14} /> تعديل</button>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-3 mt-4 text-sm">
          {partner.contact_person && <Info label="جهة الاتصال" value={partner.contact_person} />}
          {partner.phone && <Info label="الهاتف" value={partner.phone} dir="ltr" />}
          {partner.email && <Info label="البريد" value={partner.email} dir="ltr" />}
        </div>
        {partner.overallRating && (
          <div className="grid grid-cols-4 gap-3 mt-4">
            <RatingBox label="الجودة" value={partner.overallRating.quality} />
            <RatingBox label="الالتزام بالجدول" value={partner.overallRating.schedule_adherence} />
            <RatingBox label="التكلفة" value={partner.overallRating.cost} />
            <RatingBox label="السلامة" value={partner.overallRating.safety} />
          </div>
        )}
      </div>

      <div className="bg-white border border-line rounded-lg">
        <div className="px-4 py-3 border-b border-line flex items-center justify-between">
          <h3 className="font-bold text-sm text-ink">التقييمات</h3>
          <button onClick={() => setEvalOpen((o) => !o)} className="flex items-center gap-1 text-xs font-medium text-navy hover:underline"><Plus size={13} /> تقييم جديد</button>
        </div>
        {evalOpen && (
          <form onSubmit={submitEval} className="p-4 space-y-2 border-b border-line bg-line/20">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {['quality', 'schedule_adherence', 'cost', 'safety'].map((k) => (
                <label key={k} className="text-xs">
                  <span className="block text-ink-soft mb-1">{{ quality: 'الجودة', schedule_adherence: 'الالتزام بالجدول', cost: 'التكلفة', safety: 'السلامة' }[k]}</span>
                  <input type="number" min={1} max={5} value={ev[k]} onChange={(e) => setEv((f) => ({ ...f, [k]: e.target.value }))} className="w-full rounded-md border border-line px-2 py-1.5" dir="ltr" />
                </label>
              ))}
            </div>
            <textarea value={ev.overall_notes} onChange={(e) => setEv((f) => ({ ...f, overall_notes: e.target.value }))} placeholder="ملاحظات..." className="w-full rounded-md border border-line px-2 py-1.5 text-sm" rows={2} />
            <button type="submit" className="text-sm font-medium px-3 py-1.5 rounded-md bg-navy text-white">حفظ التقييم</button>
          </form>
        )}
        {partner.evaluations.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-ink-soft">لا توجد تقييمات بعد</div>
        ) : (
          <div className="divide-y divide-line">
            {partner.evaluations.map((e) => (
              <div key={e.id} className="px-4 py-3 text-sm flex items-center justify-between">
                <span className="text-ink-soft">جودة {e.quality} · جدول {e.schedule_adherence} · تكلفة {e.cost} · سلامة {e.safety}</span>
                <span className="text-xs text-ink-soft" dir="ltr">{e.created_at}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <PartnerFormModal open={editOpen} onClose={() => setEditOpen(false)} partner={partner} onSaved={() => { setEditOpen(false); load(); }} />
      <AiAssistantDrawer
        open={aiOpen} onClose={() => setAiOpen(false)} context={{ partner }}
        quickActions={[{ label: 'تحليل أداء الشريك', action: 'partner-performance', payload: { partner, evaluations: partner.evaluations, workOrders: [] } }]}
      />
    </div>
  );
}

function Info({ label, value, dir }) { return <div><div className="text-xs text-ink-soft">{label}</div><div className="text-ink font-medium" dir={dir}>{value}</div></div>; }
function RatingBox({ label, value }) { return <div className="text-center bg-line/30 rounded-md py-2"><div className="text-lg font-bold text-navy">{value?.toFixed(1)}</div><div className="text-[10px] text-ink-soft">{label}</div></div>; }
