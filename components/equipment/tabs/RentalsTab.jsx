'use client';
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Section, EmptyState } from '@/components/pm/Shared.jsx';
import StatusBadge from '@/components/equipment/StatusBadge.jsx';
import RentalFormModal from '@/components/equipment/RentalFormModal.jsx';
import { listRentals, updateRentalStatus } from '@/lib/equipmentApi.js';

export default function RentalsTab({ equipment, onChanged }) {
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    const res = await listRentals({ equipment_id: equipment.id, pageSize: 30 });
    setRentals(res.rows || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [equipment.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <Section title={`عقود الإيجار (${rentals.length})`} action={
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 text-xs font-medium text-navy hover:underline"><Plus size={13} /> عقد جديد</button>
      }>
        {!loading && rentals.length === 0 && <EmptyState title="لا توجد عقود إيجار لهذه المعدة" />}
        <div className="space-y-2">
          {rentals.map((r) => (
            <div key={r.id} className="rounded-md border border-line p-3 text-sm">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="font-medium text-ink">{r.rental_company}</span>
                  {r.contract_no && <span className="text-xs text-ink-soft mr-2">عقد رقم {r.contract_no}</span>}
                  <StatusBadge status={r.contract_status} />
                </div>
                {r.contract_status === 'active' && (
                  <button onClick={async () => { await updateRentalStatus(r.id, 'terminated'); load(); onChanged?.(); }} className="text-xs text-fail">إنهاء العقد</button>
                )}
              </div>
              <p className="text-xs text-ink-soft mt-1">{r.rental_start} → {r.rental_end || 'مفتوح'} · التكلفة الإجمالية: {r.rental_cost_total}</p>
            </div>
          ))}
        </div>
      </Section>

      <RentalFormModal open={showForm} onClose={() => setShowForm(false)} equipmentId={equipment.id} onSaved={() => { setShowForm(false); load(); onChanged?.(); }} />
    </div>
  );
}
