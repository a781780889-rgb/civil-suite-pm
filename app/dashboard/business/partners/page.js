'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, Star } from 'lucide-react';
import { EmptyState } from '@/components/pm/Shared.jsx';
import StatusBadge from '@/components/business/StatusBadge.jsx';
import PartnerFormModal from '@/components/business/PartnerFormModal.jsx';
import { listPartners } from '@/lib/businessApi.js';

export default function PartnersPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-ink-soft">جارٍ التحميل...</div>}>
      <PartnersPageInner />
    </Suspense>
  );
}

function PartnersPageInner() {
  const searchParams = useSearchParams();
  const type = searchParams.get('type') || 'contractor';
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  async function load() {
    setLoading(true);
    try { setRows((await listPartners({ partner_type: type, search: search || undefined, pageSize: 60 })).rows); }
    finally { setLoading(false); }
  }
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [search, type]);

  const title = type === 'supplier' ? 'الموردون' : 'المقاولون';

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink">{title}</h1>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-md bg-navy text-white hover:bg-navy-600"><Plus size={16} /> {type === 'supplier' ? 'مورد جديد' : 'مقاول جديد'}</button>
      </div>

      <div className="relative">
        <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم أو التخصص..." className="w-full max-w-md rounded-md border border-line bg-white pr-9 pl-3 py-2 text-sm" />
      </div>

      {loading ? <div className="text-sm text-ink-soft py-8 text-center">جارٍ التحميل...</div> : rows.length === 0 ? (
        <EmptyState title={`لا يوجد ${title}`} message="" />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((p) => (
            <Link key={p.id} href={`/dashboard/business/partners/${p.id}`} className="block bg-white border border-line rounded-lg p-4 hover:shadow-md hover:border-navy-300 transition-all">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-ink truncate">{p.company_name}</div>
                  <div className="text-xs text-ink-soft mt-0.5">{p.specialty || p.materials_services || '—'}</div>
                </div>
                <StatusBadge status={p.status} />
              </div>
              {p.rating_quality && (
                <div className="mt-2 flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={12} className={i < Math.round(p.rating_quality) ? 'fill-warnclr text-warnclr' : 'text-line'} />)}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      <PartnerFormModal open={showModal} onClose={() => setShowModal(false)} defaultType={type} onSaved={() => { setShowModal(false); load(); }} />
    </div>
  );
}
