'use client';
import { useEffect, useState, use as usePromise } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Edit2, Plus, Trash2, Send, CheckCircle2, XCircle, FileSignature, Download } from 'lucide-react';
import StatusBadge from '@/components/business/StatusBadge.jsx';
import QuoteFormModal from '@/components/business/QuoteFormModal.jsx';
import { getQuote, replaceQuoteItems, transitionQuoteStatus, convertQuoteToContract } from '@/lib/businessApi.js';
import { exportNodeToPdf } from '@/lib/pdfExport.js';

const NEXT_STATUS = { draft: 'sent', sent: 'under_review', under_review: 'negotiation', negotiation: 'won' };
const NEXT_LABEL = { draft: 'إرسال للعميل', sent: 'وضع قيد المراجعة', under_review: 'بدء تفاوض', negotiation: 'تحديد كفائز' };

export default function QuoteDetailPage({ params }) {
  const { id } = usePromise(params);
  const router = useRouter();
  const [quote, setQuote] = useState(null);
  const [items, setItems] = useState([]);
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    const q = (await getQuote(id)).quote;
    setQuote(q);
    setItems(q.items.map((it) => ({ ...it })));
  }
  useEffect(() => { load(); }, [id]);

  function updateItem(i, field, value) {
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));
  }
  function addItem() {
    setItems((arr) => [...arr, { description: '', unit: '', quantity: 1, unit_price: 0, discount_pct: 0, tax_pct: 0 }]);
  }
  function removeItem(i) {
    setItems((arr) => arr.filter((_, idx) => idx !== i));
  }
  async function saveItems() {
    setBusy(true);
    try { await replaceQuoteItems(id, items); await load(); } finally { setBusy(false); }
  }

  async function advance() {
    const next = NEXT_STATUS[quote.status];
    if (!next) return;
    setBusy(true);
    try { await transitionQuoteStatus(id, next); await load(); } finally { setBusy(false); }
  }
  async function markLost() {
    setBusy(true);
    try { await transitionQuoteStatus(id, 'lost', { decision: 'lost' }); await load(); } finally { setBusy(false); }
  }
  async function convert() {
    setBusy(true);
    try { const res = await convertQuoteToContract(id, {}); router.push(`/dashboard/business/contracts/${res.contract.id}`); } finally { setBusy(false); }
  }

  if (!quote) return <div className="p-6 text-sm text-ink-soft">جارٍ التحميل...</div>;
  const editable = ['draft', 'under_review'].includes(quote.status);
  const itemsTotal = items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0) * (1 - (Number(it.discount_pct) || 0) / 100) * (1 + (Number(it.tax_pct) || 0) / 100), 0);

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <Link href="/dashboard/business/quotes" className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink"><ArrowRight size={14} /> عروض الأسعار</Link>

      <div id="quote-print-area" className="bg-white border border-line rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><h1 className="text-xl font-bold text-ink">{quote.title}</h1><StatusBadge status={quote.status} /></div>
            <Link href={`/dashboard/business/clients/${quote.client_id}`} className="text-sm text-navy hover:underline mt-1 inline-block">{quote.client_name}</Link>
            {quote.quote_no && <div className="text-xs text-ink-soft mt-0.5">رقم العرض: {quote.quote_no}</div>}
          </div>
          <div className="flex gap-2 print:hidden">
            <button onClick={() => exportNodeToPdf(document.getElementById('quote-print-area'), `quote-${quote.quote_no || quote.id}.pdf`)} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-md border border-line hover:bg-line/50"><Download size={14} /> PDF</button>
            <button onClick={() => setEditOpen(true)} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-md border border-line hover:bg-line/50"><Edit2 size={14} /> تعديل</button>
          </div>
        </div>

        <div className="grid sm:grid-cols-4 gap-3 mt-4 text-sm">
          <Info label="صالح حتى" value={quote.validity_date || '—'} />
          <Info label="شروط الدفع" value={quote.payment_terms || '—'} />
          <Info label="مدة التنفيذ" value={quote.execution_duration_days ? `${quote.execution_duration_days} يوم` : '—'} />
          <Info label="الإجمالي" value={`${quote.total?.toLocaleString('ar-SA')} ${quote.currency}`} />
        </div>

        <div className="mt-5">
          <h3 className="font-bold text-sm text-ink mb-2">البنود</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-xs text-ink-soft border-b border-line">
                  <th className="pb-2 font-medium">الوصف</th><th className="pb-2 font-medium">الوحدة</th><th className="pb-2 font-medium">الكمية</th>
                  <th className="pb-2 font-medium">سعر الوحدة</th><th className="pb-2 font-medium">خصم %</th><th className="pb-2 font-medium">ضريبة %</th>
                  <th className="pb-2 font-medium">الإجمالي</th>{editable && <th className="pb-2 print:hidden"></th>}
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => {
                  const lineTotal = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0) * (1 - (Number(it.discount_pct) || 0) / 100) * (1 + (Number(it.tax_pct) || 0) / 100);
                  return (
                    <tr key={i} className="border-b border-line/60">
                      {editable ? (
                        <>
                          <td className="py-1.5 pl-2"><input value={it.description} onChange={(e) => updateItem(i, 'description', e.target.value)} className="w-full rounded border border-line px-2 py-1 text-xs" /></td>
                          <td className="py-1.5"><input value={it.unit || ''} onChange={(e) => updateItem(i, 'unit', e.target.value)} className="w-16 rounded border border-line px-2 py-1 text-xs" /></td>
                          <td className="py-1.5"><input type="number" value={it.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} className="w-16 rounded border border-line px-2 py-1 text-xs" dir="ltr" /></td>
                          <td className="py-1.5"><input type="number" value={it.unit_price} onChange={(e) => updateItem(i, 'unit_price', e.target.value)} className="w-20 rounded border border-line px-2 py-1 text-xs" dir="ltr" /></td>
                          <td className="py-1.5"><input type="number" value={it.discount_pct} onChange={(e) => updateItem(i, 'discount_pct', e.target.value)} className="w-14 rounded border border-line px-2 py-1 text-xs" dir="ltr" /></td>
                          <td className="py-1.5"><input type="number" value={it.tax_pct} onChange={(e) => updateItem(i, 'tax_pct', e.target.value)} className="w-14 rounded border border-line px-2 py-1 text-xs" dir="ltr" /></td>
                          <td className="py-1.5 font-mono text-xs">{lineTotal.toLocaleString('ar-SA')}</td>
                          <td className="print:hidden"><button onClick={() => removeItem(i)} className="text-ink-soft hover:text-fail p-1"><Trash2 size={13} /></button></td>
                        </>
                      ) : (
                        <>
                          <td className="py-1.5">{it.description}</td><td className="py-1.5">{it.unit}</td><td className="py-1.5">{it.quantity}</td>
                          <td className="py-1.5 font-mono">{it.unit_price}</td><td className="py-1.5">{it.discount_pct}%</td><td className="py-1.5">{it.tax_pct}%</td>
                          <td className="py-1.5 font-mono">{it.line_total?.toLocaleString('ar-SA') ?? lineTotal.toLocaleString('ar-SA')}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {editable && (
            <div className="flex items-center justify-between mt-2 print:hidden">
              <button onClick={addItem} className="flex items-center gap-1 text-xs font-medium text-navy hover:underline"><Plus size={13} /> إضافة بند</button>
              <button onClick={saveItems} disabled={busy} className="text-xs font-medium px-3 py-1.5 rounded-md bg-navy text-white disabled:opacity-50">حفظ البنود (إجمالي تقديري: {itemsTotal.toLocaleString('ar-SA')})</button>
            </div>
          )}
          <div className="text-left mt-3 text-sm space-y-1">
            <div className="text-ink-soft">الإجمالي الفرعي: <span className="font-mono text-ink">{quote.subtotal?.toLocaleString('ar-SA')}</span></div>
            <div className="text-ink-soft">الخصم: <span className="font-mono text-ink">{quote.discount_value?.toLocaleString('ar-SA')}</span></div>
            <div className="text-ink-soft">الضريبة: <span className="font-mono text-ink">{quote.tax_value?.toLocaleString('ar-SA')}</span></div>
            <div className="font-bold text-ink">الإجمالي: <span className="font-mono">{quote.total?.toLocaleString('ar-SA')} {quote.currency}</span></div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 print:hidden">
        {NEXT_STATUS[quote.status] && (
          <button onClick={advance} disabled={busy} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-md bg-navy text-white disabled:opacity-50"><Send size={14} /> {NEXT_LABEL[quote.status]}</button>
        )}
        {['sent', 'under_review', 'negotiation'].includes(quote.status) && (
          <button onClick={markLost} disabled={busy} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-md bg-fail/10 text-fail disabled:opacity-50"><XCircle size={14} /> خسارة</button>
        )}
        {quote.status === 'won' && (
          <button onClick={convert} disabled={busy} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-md bg-pass text-white disabled:opacity-50"><FileSignature size={14} /> تحويل إلى عقد</button>
        )}
      </div>

      {quote.approvals?.length > 0 && (
        <div className="bg-white border border-line rounded-lg p-4">
          <h3 className="font-bold text-sm text-ink mb-2 flex items-center gap-1.5"><CheckCircle2 size={14} /> سجل القرارات</h3>
          <div className="space-y-1.5 text-xs text-ink-soft">
            {quote.approvals.map((a) => <div key={a.id}>{a.action} — {a.decision} — {a.actor || 'غير محدد'} — <span dir="ltr">{a.created_at}</span></div>)}
          </div>
        </div>
      )}

      <QuoteFormModal open={editOpen} onClose={() => setEditOpen(false)} quote={quote} onSaved={() => { setEditOpen(false); load(); }} />
    </div>
  );
}

function Info({ label, value }) {
  return <div><div className="text-xs text-ink-soft">{label}</div><div className="text-ink font-medium">{value}</div></div>;
}
