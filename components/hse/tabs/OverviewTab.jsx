'use client';
import { useEffect, useState } from 'react';
import { Plus, MapPin } from 'lucide-react';
import { StatCard, Section, EmptyState } from '@/components/pm/Shared.jsx';
import { FieldGroup, TextField, SelectField } from '@/components/ui/Field.jsx';
import { TextAreaField } from '@/components/pm/PmField.jsx';
import { SITE_STATUS_OPTIONS, optionLabel } from '@/lib/hseConstants.js';
import * as hseApi from '@/lib/hseApi.js';

export default function OverviewTab({ projectId }) {
  const [dashboard, setDashboard] = useState(null);
  const [sites, setSites] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', location: '', operational_zones: '', current_activities: '', key_hazards: '', safety_officer: '' });
  const [saving, setSaving] = useState(false);

  async function load() {
    const [d, s] = await Promise.all([hseApi.getDashboard({ project_id: projectId }), hseApi.listSites({ project_id: projectId })]);
    setDashboard(d.dashboard);
    setSites(s.rows);
  }
  useEffect(() => { load(); }, [projectId]);

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await hseApi.createSite({ ...form, project_id: projectId });
      setForm({ name: '', location: '', operational_zones: '', current_activities: '', key_hazards: '', safety_officer: '' });
      setShowForm(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  if (!dashboard) return <p className="text-sm text-ink-soft">جارٍ التحميل...</p>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="حوادث المشروع" value={dashboard.totals.incident_count} tone="fail" small />
        <StatCard label="مخاطر حرجة" value={dashboard.totals.critical_risk_count} tone="fail" small />
        <StatCard label="تصاريح نشطة" value={dashboard.totals.active_permits} tone="navy" small />
        <StatCard label="نسبة الالتزام" value={dashboard.kpis.compliance_rate !== null ? `${dashboard.kpis.compliance_rate}%` : '—'} tone="pass" small />
      </div>

      <Section title="مواقع العمل" action={
        <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-1 rounded-sheet bg-navy-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-800">
          <Plus size={15} /> موقع جديد
        </button>
      }>
        {showForm && (
          <form onSubmit={handleCreate} className="mb-4 space-y-3 rounded-sheet border border-line bg-paper p-4">
            <FieldGroup cols={2}>
              <TextField label="اسم الموقع" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
              <TextField label="الموقع/العنوان" value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
              <TextField label="المناطق التشغيلية" value={form.operational_zones} onChange={(v) => setForm({ ...form, operational_zones: v })} />
              <TextField label="مسؤول السلامة" value={form.safety_officer} onChange={(v) => setForm({ ...form, safety_officer: v })} />
            </FieldGroup>
            <TextAreaField label="الأنشطة الجارية" value={form.current_activities} onChange={(v) => setForm({ ...form, current_activities: v })} rows={2} />
            <TextAreaField label="المخاطر الرئيسية" value={form.key_hazards} onChange={(v) => setForm({ ...form, key_hazards: v })} rows={2} />
            <button type="submit" disabled={saving} className="rounded-sheet bg-navy-700 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-50">
              {saving ? 'جارٍ الحفظ...' : 'حفظ الموقع'}
            </button>
          </form>
        )}
        {sites.length === 0 ? <EmptyState icon={MapPin} title="لا مواقع" message="أضف أول موقع عمل لهذا المشروع." /> : (
          <div className="grid gap-3 md:grid-cols-2">
            {sites.map((s) => (
              <div key={s.id} className="rounded-sheet border border-line bg-white p-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-ink">{s.name}</p>
                  <span className="text-xs text-ink-soft">{optionLabel(SITE_STATUS_OPTIONS, s.site_status)}</span>
                </div>
                {s.location && <p className="text-sm text-ink-soft">{s.location}</p>}
                <div className="mt-2 flex gap-4 text-xs text-ink-soft">
                  <span>العاملون: {s.workforce_count}</span>
                  <span>المعدات: {s.equipment_count}</span>
                  {s.last_inspection_date && <span>آخر تفتيش: {s.last_inspection_date}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
