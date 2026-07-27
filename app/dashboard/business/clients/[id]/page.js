'use client';
import { useEffect, useState, use as usePromise } from 'react';
import Link from 'next/link';
import { ArrowRight, Edit2, Plus, Trash2, Star, Sparkles } from 'lucide-react';
import { EmptyState } from '@/components/pm/Shared.jsx';
import StatusBadge from '@/components/business/StatusBadge.jsx';
import ClientFormModal from '@/components/business/ClientFormModal.jsx';
import AiAssistantDrawer from '@/components/business/AiAssistantDrawer.jsx';
import { getClient, deleteClientContact, createClientContact } from '@/lib/businessApi.js';

const TABS = [
  { key: 'overview', label: 'نظرة عامة' },
  { key: 'contacts', label: 'جهات الاتصال' },
  { key: 'opportunities', label: 'الفرص' },
  { key: 'quotes', label: 'عروض الأسعار' },
  { key: 'contracts', label: 'العقود' },
  { key: 'correspondence', label: 'المراسلات' },
  { key: 'meetings', label: 'الاجتماعات' },
];

export default function ClientDetailPage({ params }) {
  const { id } = usePromise(params);
  const [client, setClient] = useState(null);
  const [tab, setTab] = useState('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  async function load() { setClient(await (await getClient(id)).client); }
  useEffect(() => { load(); }, [id]);

  if (!client) return <div className="p-6 text-sm text-ink-soft">جارٍ التحميل...</div>;
  const h = client.history;

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <Link href="/dashboard/business/clients" className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink"><ArrowRight size={14} /> العملاء</Link>

      <div className="bg-white border border-line rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-ink">{client.name}</h1>
              <StatusBadge status={client.status} />
            </div>
            <div className="text-sm text-ink-soft mt-1">{client.client_code ? `#${client.client_code} · ` : ''}{{ company: 'شركة', individual: 'فرد', government: 'جهة حكومية' }[client.client_type]}</div>
            {client.rating && (
              <div className="mt-1.5 flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={13} className={i < client.rating ? 'fill-warnclr text-warnclr' : 'text-line'} />)}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setAiOpen(true)} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-md bg-navy/10 text-navy hover:bg-navy/20"><Sparkles size={14} /> تحليل ذكي</button>
            <button onClick={() => setEditOpen(true)} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-md border border-line hover:bg-line/50"><Edit2 size={14} /> تعديل</button>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-3 mt-4 text-sm">
          {client.phone && <InfoRow label="الهاتف" value={client.phone} dir="ltr" />}
          {client.email && <InfoRow label="البريد" value={client.email} dir="ltr" />}
          {client.city && <InfoRow label="المدينة" value={client.city} />}
          {client.contact_person && <InfoRow label="جهة الاتصال" value={`${client.contact_person}${client.contact_title ? ' — ' + client.contact_title : ''}`} />}
        </div>
        {client.notes && <p className="mt-3 text-sm text-ink-soft bg-line/30 rounded-md px-3 py-2">{client.notes}</p>}
      </div>

      <div className="flex gap-1 border-b border-line overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-3.5 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t.key ? 'border-navy text-navy' : 'border-transparent text-ink-soft hover:text-ink'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid sm:grid-cols-3 gap-3">
          <StatBox label="الفرص" value={h.opportunities.length} />
          <StatBox label="عروض الأسعار" value={h.quotes.length} />
          <StatBox label="العقود" value={h.contracts.length} />
        </div>
      )}

      {tab === 'contacts' && <ContactsTab clientId={id} contacts={h.contacts} onChange={load} />}

      {tab === 'opportunities' && (
        <ListTab rows={h.opportunities} empty="لا توجد فرص لهذا العميل" render={(o) => (
          <Link key={o.id} href={`/dashboard/business/opportunities/${o.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-line/40">
            <span className="text-sm text-ink">{o.name}</span>
            <div className="flex items-center gap-3"><span className="text-xs text-ink-soft font-mono">{o.expected_value?.toLocaleString('ar-SA')}</span><StatusBadge status={o.stage} /></div>
          </Link>
        )} />
      )}

      {tab === 'quotes' && (
        <ListTab rows={h.quotes} empty="لا توجد عروض أسعار لهذا العميل" render={(q) => (
          <Link key={q.id} href={`/dashboard/business/quotes/${q.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-line/40">
            <span className="text-sm text-ink">{q.title}</span>
            <div className="flex items-center gap-3"><span className="text-xs text-ink-soft font-mono">{q.total?.toLocaleString('ar-SA')}</span><StatusBadge status={q.status} /></div>
          </Link>
        )} />
      )}

      {tab === 'contracts' && (
        <ListTab rows={h.contracts} empty="لا توجد عقود لهذا العميل" render={(k) => (
          <Link key={k.id} href={`/dashboard/business/contracts/${k.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-line/40">
            <span className="text-sm text-ink">{k.title}</span>
            <div className="flex items-center gap-3"><span className="text-xs text-ink-soft font-mono">{k.current_value?.toLocaleString('ar-SA')}</span><StatusBadge status={k.status} /></div>
          </Link>
        )} />
      )}

      {tab === 'correspondence' && (
        <ListTab rows={h.correspondence} empty="لا توجد مراسلات لهذا العميل" render={(c) => (
          <div key={c.id} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-ink">{c.subject}</span>
            <span className="text-xs text-ink-soft" dir="ltr">{c.correspondence_date}</span>
          </div>
        )} />
      )}

      {tab === 'meetings' && (
        <ListTab rows={h.meetings} empty="لا توجد اجتماعات لهذا العميل" render={(m) => (
          <Link key={m.id} href={`/dashboard/business/meetings/${m.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-line/40">
            <span className="text-sm text-ink">{m.title}</span>
            <span className="text-xs text-ink-soft" dir="ltr">{m.meeting_date}</span>
          </Link>
        )} />
      )}

      <ClientFormModal open={editOpen} onClose={() => setEditOpen(false)} client={client} onSaved={() => { setEditOpen(false); load(); }} />
      <AiAssistantDrawer
        open={aiOpen} onClose={() => setAiOpen(false)}
        context={{ client }}
        quickActions={[{ label: 'تحليل أداء العميل', action: 'client-analysis', payload: { client, opportunities: h.opportunities, quotes: h.quotes, contracts: h.contracts, payments: [] } }]}
      />
    </div>
  );
}

function InfoRow({ label, value, dir }) {
  return <div><div className="text-xs text-ink-soft">{label}</div><div className="text-ink font-medium" dir={dir}>{value}</div></div>;
}
function StatBox({ label, value }) {
  return <div className="bg-white border border-line rounded-lg p-4 text-center"><div className="text-2xl font-bold text-navy">{value}</div><div className="text-xs text-ink-soft mt-1">{label}</div></div>;
}
function ListTab({ rows, empty, render }) {
  if (rows.length === 0) return <EmptyState title={empty} message="" />;
  return <div className="bg-white border border-line rounded-lg divide-y divide-line">{rows.map(render)}</div>;
}

function ContactsTab({ clientId, contacts, onChange }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [title, setTitle] = useState('');

  async function add(e) {
    e.preventDefault();
    if (!name.trim()) return;
    await createClientContact(clientId, { name, phone, title });
    setName(''); setPhone(''); setTitle(''); setAdding(false);
    onChange();
  }

  return (
    <div className="bg-white border border-line rounded-lg divide-y divide-line">
      {contacts.length === 0 && !adding && <EmptyState title="لا توجد جهات اتصال" message="" />}
      {contacts.map((c) => (
        <div key={c.id} className="flex items-center justify-between px-4 py-3">
          <div>
            <div className="text-sm font-medium text-ink">{c.name} {c.is_primary ? <span className="text-[10px] bg-navy/10 text-navy rounded-full px-1.5 py-0.5 mr-1">رئيسي</span> : null}</div>
            <div className="text-xs text-ink-soft">{c.title}{c.phone ? ` · ${c.phone}` : ''}</div>
          </div>
          <button onClick={async () => { await deleteClientContact(clientId, c.id); onChange(); }} className="text-ink-soft hover:text-fail p-1"><Trash2 size={14} /></button>
        </div>
      ))}
      {adding ? (
        <form onSubmit={add} className="p-3 flex flex-wrap gap-2 items-center">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم" className="rounded-md border border-line px-2 py-1.5 text-sm flex-1 min-w-[120px]" />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="المسمى" className="rounded-md border border-line px-2 py-1.5 text-sm flex-1 min-w-[120px]" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="الهاتف" className="rounded-md border border-line px-2 py-1.5 text-sm flex-1 min-w-[120px]" dir="ltr" />
          <button type="submit" className="text-sm font-medium px-3 py-1.5 rounded-md bg-navy text-white">إضافة</button>
        </form>
      ) : (
        <button onClick={() => setAdding(true)} className="w-full flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium text-navy hover:bg-line/40"><Plus size={14} /> جهة اتصال جديدة</button>
      )}
    </div>
  );
}
