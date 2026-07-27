'use client';
import { useEffect, useState, use as usePromise } from 'react';
import Link from 'next/link';
import { ArrowRight, Edit2, Plus, CheckCircle2, XCircle, Send, Banknote } from 'lucide-react';
import StatusBadge from '@/components/business/StatusBadge.jsx';
import ContractFormModal from '@/components/business/ContractFormModal.jsx';
import {
  getContract, updateContract, transitionContractStatus,
  createChangeOrder, submitChangeOrder, decideChangeOrder,
  createProgressPayment, submitProgressPayment, decideProgressPayment, markProgressPaymentPaid,
} from '@/lib/businessApi.js';

const TABS = [{ key: 'overview', label: 'نظرة عامة' }, { key: 'change_orders', label: 'أوامر التغيير' }, { key: 'payments', label: 'المستخلصات' }, { key: 'approvals', label: 'سجل الموافقات' }];
const CONTRACT_STATUSES = ['draft', 'under_review', 'pending_approval', 'active', 'completed', 'terminated', 'cancelled'];

export default function ContractDetailPage({ params }) {
  const { id } = usePromise(params);
  const [contract, setContract] = useState(null);
  const [tab, setTab] = useState('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() { setContract((await getContract(id)).contract); }
  useEffect(() => { load(); }, [id]);

  async function changeStatus(status) {
    setBusy(true);
    try { await transitionContractStatus(id, status); await load(); } finally { setBusy(false); }
  }

  if (!contract) return <div className="p-6 text-sm text-ink-soft">جارٍ التحميل...</div>;

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <Link href="/dashboard/business/contracts" className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink"><ArrowRight size={14} /> العقود</Link>

      <div className="bg-white border border-line rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><h1 className="text-xl font-bold text-ink">{contract.title}</h1><StatusBadge status={contract.status} /></div>
            <Link href={`/dashboard/business/clients/${contract.client_id}`} className="text-sm text-navy hover:underline mt-1 inline-block">{contract.client_name}</Link>
            {contract.contract_no && <div className="text-xs text-ink-soft mt-0.5">رقم العقد: {contract.contract_no}</div>}
          </div>
          <button onClick={() => setEditOpen(true)} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-md border border-line hover:bg-line/50"><Edit2 size={14} /> تعديل</button>
        </div>
        <div className="grid sm:grid-cols-4 gap-3 mt-4 text-sm">
          <Info label="القيمة الأصلية" value={contract.original_value?.toLocaleString('ar-SA')} />
          <Info label="القيمة الحالية" value={contract.current_value?.toLocaleString('ar-SA')} />
          <Info label="تاريخ البداية" value={contract.start_date || '—'} />
          <Info label="تاريخ النهاية" value={contract.end_date || '—'} />
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <select value="" onChange={(e) => e.target.value && changeStatus(e.target.value)} disabled={busy} className="text-sm rounded-md border border-line px-3 py-2">
            <option value="">تغيير الحالة...</option>
            {CONTRACT_STATUSES.filter((s) => s !== contract.status).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-1 border-b border-line overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-3.5 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 ${tab === t.key ? 'border-navy text-navy' : 'border-transparent text-ink-soft hover:text-ink'}`}>{t.label}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="bg-white border border-line rounded-lg p-4 space-y-2 text-sm">
          {contract.scope_of_work && <Block label="نطاق العمل" value={contract.scope_of_work} />}
          {contract.payment_terms && <Block label="شروط الدفع" value={contract.payment_terms} />}
          {contract.warranties && <Block label="الضمانات" value={contract.warranties} />}
          {contract.obligations && <Block label="الالتزامات" value={contract.obligations} />}
          {contract.special_terms && <Block label="بنود خاصة" value={contract.special_terms} />}
        </div>
      )}

      {tab === 'change_orders' && <ChangeOrdersTab contractId={id} orders={contract.changeOrders} onChange={load} />}
      {tab === 'payments' && <PaymentsTab contractId={id} payments={contract.progressPayments} onChange={load} />}
      {tab === 'approvals' && (
        <div className="bg-white border border-line rounded-lg divide-y divide-line">
          {contract.approvals.length === 0 ? <div className="px-4 py-6 text-center text-sm text-ink-soft">لا توجد قرارات مسجّلة بعد</div> :
            contract.approvals.map((a) => (
              <div key={a.id} className="px-4 py-3 text-sm flex items-center justify-between">
                <span className="text-ink">{a.action} — {a.decision}{a.notes ? ` (${a.notes})` : ''}</span>
                <span className="text-xs text-ink-soft">{a.actor || 'غير محدد'} · <span dir="ltr">{a.created_at}</span></span>
              </div>
            ))}
        </div>
      )}

      <ContractFormModal open={editOpen} onClose={() => setEditOpen(false)} contract={contract} onSaved={() => { setEditOpen(false); load(); }} />
    </div>
  );
}

function Info({ label, value }) { return <div><div className="text-xs text-ink-soft">{label}</div><div className="text-ink font-medium">{value}</div></div>; }
function Block({ label, value }) { return <div><div className="text-xs font-bold text-ink-soft mb-0.5">{label}</div><div className="text-ink whitespace-pre-wrap">{value}</div></div>; }

function ChangeOrdersTab({ contractId, orders, onChange }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ description: '', reason: '', delta_value: '', duration_impact_days: '' });

  async function add(e) {
    e.preventDefault();
    await createChangeOrder(contractId, form);
    setForm({ description: '', reason: '', delta_value: '', duration_impact_days: '' });
    setAdding(false);
    onChange();
  }

  return (
    <div className="bg-white border border-line rounded-lg divide-y divide-line">
      {orders.length === 0 && !adding && <div className="px-4 py-6 text-center text-sm text-ink-soft">لا توجد أوامر تغيير</div>}
      {orders.map((co) => (
        <div key={co.id} className="px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-medium text-ink">{co.co_no ? `${co.co_no} — ` : ''}{co.description}</div>
              <div className="text-xs text-ink-soft mt-0.5">فرق القيمة: <span className="font-mono">{co.delta_value?.toLocaleString('ar-SA')}</span>{co.reason ? ` · ${co.reason}` : ''}</div>
            </div>
            <StatusBadge status={co.status} />
          </div>
          <div className="flex gap-2 mt-2">
            {co.status === 'draft' && <button onClick={async () => { await submitChangeOrder(contractId, co.id); onChange(); }} className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded bg-navy/10 text-navy"><Send size={11} /> تقديم للاعتماد</button>}
            {co.status === 'pending_approval' && (
              <>
                <button onClick={async () => { await decideChangeOrder(contractId, co.id, true); onChange(); }} className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded bg-pass/10 text-pass"><CheckCircle2 size={11} /> اعتماد</button>
                <button onClick={async () => { await decideChangeOrder(contractId, co.id, false); onChange(); }} className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded bg-fail/10 text-fail"><XCircle size={11} /> رفض</button>
              </>
            )}
          </div>
        </div>
      ))}
      {adding ? (
        <form onSubmit={add} className="p-3 space-y-2">
          <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} required placeholder="وصف التغيير" className="w-full rounded-md border border-line px-2 py-1.5 text-sm" />
          <input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="السبب" className="w-full rounded-md border border-line px-2 py-1.5 text-sm" />
          <div className="flex gap-2">
            <input type="number" value={form.delta_value} onChange={(e) => setForm((f) => ({ ...f, delta_value: e.target.value }))} placeholder="فرق القيمة (+/-)" className="flex-1 rounded-md border border-line px-2 py-1.5 text-sm" dir="ltr" />
            <input type="number" value={form.duration_impact_days} onChange={(e) => setForm((f) => ({ ...f, duration_impact_days: e.target.value }))} placeholder="أثر المدة (أيام)" className="flex-1 rounded-md border border-line px-2 py-1.5 text-sm" dir="ltr" />
          </div>
          <button type="submit" className="text-sm font-medium px-3 py-1.5 rounded-md bg-navy text-white">إضافة</button>
        </form>
      ) : (
        <button onClick={() => setAdding(true)} className="w-full flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium text-navy hover:bg-line/40"><Plus size={14} /> أمر تغيير جديد</button>
      )}
    </div>
  );
}

function PaymentsTab({ contractId, payments, onChange }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ certificate_no: '', period_from: '', period_to: '', work_value_to_date: '', previous_work_value: '', retention_pct: 10, other_deductions: 0 });

  async function add(e) {
    e.preventDefault();
    await createProgressPayment(contractId, form);
    setForm({ certificate_no: '', period_from: '', period_to: '', work_value_to_date: '', previous_work_value: '', retention_pct: 10, other_deductions: 0 });
    setAdding(false);
    onChange();
  }

  return (
    <div className="bg-white border border-line rounded-lg divide-y divide-line">
      {payments.length === 0 && !adding && <div className="px-4 py-6 text-center text-sm text-ink-soft">لا توجد مستخلصات</div>}
      {payments.map((p) => (
        <div key={p.id} className="px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-medium text-ink">{p.certificate_no || `مستخلص #${p.id}`}</div>
              <div className="text-xs text-ink-soft mt-0.5">حتى {p.period_to || '—'} · صافي المستحق: <span className="font-mono">{p.net_due?.toLocaleString('ar-SA')}</span></div>
            </div>
            <StatusBadge status={p.status} />
          </div>
          <div className="flex gap-2 mt-2">
            {p.status === 'draft' && <button onClick={async () => { await submitProgressPayment(contractId, p.id); onChange(); }} className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded bg-navy/10 text-navy"><Send size={11} /> تقديم للاعتماد</button>}
            {p.status === 'pending_approval' && (
              <>
                <button onClick={async () => { await decideProgressPayment(contractId, p.id, true); onChange(); }} className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded bg-pass/10 text-pass"><CheckCircle2 size={11} /> اعتماد</button>
                <button onClick={async () => { await decideProgressPayment(contractId, p.id, false); onChange(); }} className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded bg-fail/10 text-fail"><XCircle size={11} /> رفض</button>
              </>
            )}
            {p.status === 'approved' && <button onClick={async () => { await markProgressPaymentPaid(contractId, p.id); onChange(); }} className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded bg-pass/10 text-pass"><Banknote size={11} /> تسجيل الصرف</button>}
          </div>
        </div>
      ))}
      {adding ? (
        <form onSubmit={add} className="p-3 space-y-2">
          <div className="flex gap-2">
            <input value={form.certificate_no} onChange={(e) => setForm((f) => ({ ...f, certificate_no: e.target.value }))} placeholder="رقم المستخلص" className="flex-1 rounded-md border border-line px-2 py-1.5 text-sm" />
            <input type="date" value={form.period_to} onChange={(e) => setForm((f) => ({ ...f, period_to: e.target.value }))} className="flex-1 rounded-md border border-line px-2 py-1.5 text-sm" dir="ltr" />
          </div>
          <div className="flex gap-2">
            <input type="number" value={form.work_value_to_date} onChange={(e) => setForm((f) => ({ ...f, work_value_to_date: e.target.value }))} placeholder="قيمة الأعمال حتى تاريخه" className="flex-1 rounded-md border border-line px-2 py-1.5 text-sm" dir="ltr" />
            <input type="number" value={form.previous_work_value} onChange={(e) => setForm((f) => ({ ...f, previous_work_value: e.target.value }))} placeholder="الأعمال السابقة" className="flex-1 rounded-md border border-line px-2 py-1.5 text-sm" dir="ltr" />
          </div>
          <div className="flex gap-2">
            <input type="number" value={form.retention_pct} onChange={(e) => setForm((f) => ({ ...f, retention_pct: e.target.value }))} placeholder="نسبة الضمان %" className="flex-1 rounded-md border border-line px-2 py-1.5 text-sm" dir="ltr" />
            <input type="number" value={form.other_deductions} onChange={(e) => setForm((f) => ({ ...f, other_deductions: e.target.value }))} placeholder="استقطاعات أخرى" className="flex-1 rounded-md border border-line px-2 py-1.5 text-sm" dir="ltr" />
          </div>
          <button type="submit" className="text-sm font-medium px-3 py-1.5 rounded-md bg-navy text-white">إضافة</button>
        </form>
      ) : (
        <button onClick={() => setAdding(true)} className="w-full flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium text-navy hover:bg-line/40"><Plus size={14} /> مستخلص جديد</button>
      )}
    </div>
  );
}
