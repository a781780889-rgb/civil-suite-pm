'use client';
import { useEffect, useState } from 'react';
import { Plus, XCircle, ShieldCheck } from 'lucide-react';
import { Section, EmptyState } from '@/components/pm/Shared.jsx';
import { SelectField } from '@/components/ui/Field.jsx';
import { listAuthorizedOperators, authorizeOperator, revokeOperatorAuthorization, listOperators } from '@/lib/equipmentApi.js';

export default function OperatorsTab({ equipment }) {
  const [authorized, setAuthorized] = useState([]);
  const [allOperators, setAllOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [auth, all] = await Promise.all([listAuthorizedOperators(equipment.id), listOperators({ is_active: true, pageSize: 200 })]);
    setAuthorized(auth.rows || []);
    setAllOperators(all.rows || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [equipment.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const authorizedIds = new Set(authorized.map((o) => o.id));
  const available = allOperators.filter((o) => !authorizedIds.has(o.id));

  async function handleAuthorize() {
    if (!selected) return;
    setSaving(true);
    try { await authorizeOperator(equipment.id, Number(selected)); setSelected(''); setShowForm(false); load(); }
    finally { setSaving(false); }
  }

  async function handleRevoke(operatorId) {
    await revokeOperatorAuthorization(equipment.id, operatorId);
    load();
  }

  return (
    <div className="space-y-4">
      <Section title={`المشغلون المصرَّح لهم بتشغيل هذه المعدة (${authorized.length})`} action={
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 text-xs font-medium text-navy hover:underline"><Plus size={13} /> تفويض مشغل</button>
      }>
        {!loading && authorized.length === 0 && <EmptyState title="لا يوجد مشغلون مصرَّح لهم بعد" description="أي محاولة تسجيل تشغيل بمشغل غير مصرَّح له سترفض تلقائياً." />}
        <div className="space-y-2">
          {authorized.map((o) => (
            <div key={o.id} className="rounded-md border border-line p-3 text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-pass" />
                <span className="font-medium text-ink">{o.name}</span>
                {o.license_type && <span className="text-xs text-ink-soft">{o.license_type} — ينتهي {o.license_expiry || '—'}</span>}
              </div>
              <button onClick={() => handleRevoke(o.id)} className="text-xs text-fail flex items-center gap-1"><XCircle size={12} /> إلغاء التفويض</button>
            </div>
          ))}
        </div>
      </Section>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-navy-900/40" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-xl shadow-xl p-5">
            <h3 className="font-bold text-ink mb-4">تفويض مشغل على {equipment.name}</h3>
            <SelectField label="المشغل" value={selected} onChange={setSelected} options={available.map((o) => ({ value: o.id, label: o.name }))} />
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-md border border-line text-sm">إلغاء</button>
              <button onClick={handleAuthorize} disabled={saving || !selected} className="px-4 py-2 rounded-md bg-navy text-white text-sm disabled:opacity-60">{saving ? 'جارِ الحفظ…' : 'تفويض'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
