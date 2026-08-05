'use client';
import { useEffect, useState } from 'react';
import { Plus, RotateCcw, CheckCircle2 } from 'lucide-react';
import { Section, EmptyState } from '@/components/pm/Shared.jsx';
import { FieldGroup, TextField, SelectField, NumberField } from '@/components/ui/Field.jsx';
import { TextAreaField, DateField } from '@/components/pm/PmField.jsx';
import { RiskLevelBadge, StatusBadge } from '@/components/hse/StatusBadge.jsx';
import { RISK_CATEGORY_OPTIONS, RISK_STATUS_OPTIONS, optionLabel } from '@/lib/hseConstants.js';
import * as hseApi from '@/lib/hseApi.js';

const EMPTY = { title: '', description: '', location: '', activity: '', category: 'other', cause: '', likelihood: 3, severity: 3, control_measures: '', responsible: '', review_date: '' };

export default function RisksTab({ projectId }) {
  const [risks, setRisks] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [reassessId, setReassessId] = useState(null);
  const [reassessForm, setReassessForm] = useState({ likelihood: 3, severity: 3, note: '' });

  async function load() { const res = await hseApi.listRisks({ project_id: projectId, pageSize: 100 }); setRisks(res.rows); }
  useEffect(() => { load(); }, [projectId]);

  async function handleCreate(e) {
    e.preventDefault(); setSaving(true);
    try { await hseApi.createRisk({ ...form, project_id: projectId }); setForm(EMPTY); setShowForm(false); load(); }
    finally { setSaving(false); }
  }

  async function handleReassess(id) {
    await hseApi.reassessRisk(id, reassessForm);
    setReassessId(null); load();
  }

  async function handleClose(id) { await hseApi.closeRisk(id); load(); }

  const previewScore = form.likelihood * form.severity;

  return (
    <Section title="سجل المخاطر" action={
      <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-1 rounded-sheet bg-navy-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-800">
        <Plus size={15} /> خطر جديد
      </button>
    }>
      {showForm && (
        <form onSubmit={handleCreate} className="mb-4 space-y-3 rounded-sheet border border-line bg-paper p-4">
          <FieldGroup cols={2}>
            <TextField label="اسم الخطر" value={form.title} onChange={(v) => setForm({ ...form, title: v })} required />
            <SelectField label="الفئة" value={form.category} onChange={(v) => setForm({ ...form, category: v })} options={RISK_CATEGORY_OPTIONS} />
            <TextField label="الموقع" value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
            <TextField label="النشاط المرتبط" value={form.activity} onChange={(v) => setForm({ ...form, activity: v })} />
            <NumberField label="الاحتمالية (1-5)" value={form.likelihood} onChange={(v) => setForm({ ...form, likelihood: Number(v) })} min={1} step={1} />
            <NumberField label="شدة التأثير (1-5)" value={form.severity} onChange={(v) => setForm({ ...form, severity: Number(v) })} min={1} step={1} />
            <TextField label="المسؤول" value={form.responsible} onChange={(v) => setForm({ ...form, responsible: v })} />
            <DateField label="تاريخ المراجعة" value={form.review_date} onChange={(v) => setForm({ ...form, review_date: v })} />
          </FieldGroup>
          <p className="text-sm text-ink-soft">الدرجة المتوقعة: <span className="font-semibold text-ink">{previewScore}/25</span></p>
          <TextAreaField label="الوصف" value={form.description} onChange={(v) => setForm({ ...form, description: v })} rows={2} />
          <TextAreaField label="إجراءات التحكم" value={form.control_measures} onChange={(v) => setForm({ ...form, control_measures: v })} rows={2} />
          <button type="submit" disabled={saving} className="rounded-sheet bg-navy-700 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-50">
            {saving ? 'جارٍ الحفظ...' : 'حفظ الخطر'}
          </button>
        </form>
      )}

      {risks.length === 0 ? <EmptyState title="لا مخاطر" message="سجّل أول خطر لهذا المشروع." /> : (
        <div className="space-y-2">
          {risks.map((r) => (
            <div key={r.id} className="rounded-sheet border border-line bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">{r.risk_no} — {r.title}</p>
                  <p className="text-xs text-ink-soft">{optionLabel(RISK_CATEGORY_OPTIONS, r.category)} {r.location ? `· ${r.location}` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <RiskLevelBadge level={r.risk_level} small />
                  <span className="text-xs text-ink-soft">{r.risk_score}/25</span>
                  <StatusBadge status={r.status} small />
                </div>
              </div>
              {r.status !== 'closed' && (
                <div className="mt-2 flex gap-2">
                  <button onClick={() => setReassessId(reassessId === r.id ? null : r.id)} className="flex items-center gap-1 text-xs text-navy-600 hover:underline">
                    <RotateCcw size={12} /> إعادة تقييم
                  </button>
                  <button onClick={() => handleClose(r.id)} className="flex items-center gap-1 text-xs text-pass-700 hover:underline">
                    <CheckCircle2 size={12} /> إغلاق
                  </button>
                </div>
              )}
              {reassessId === r.id && (
                <div className="mt-2 flex flex-wrap items-end gap-2 rounded-sheet bg-paper p-2">
                  <NumberField label="احتمالية جديدة" value={reassessForm.likelihood} onChange={(v) => setReassessForm({ ...reassessForm, likelihood: Number(v) })} min={1} step={1} />
                  <NumberField label="شدة جديدة" value={reassessForm.severity} onChange={(v) => setReassessForm({ ...reassessForm, severity: Number(v) })} min={1} step={1} />
                  <button onClick={() => handleReassess(r.id)} className="rounded-sheet bg-navy-700 px-3 py-2 text-xs font-medium text-white">حفظ إعادة التقييم</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
