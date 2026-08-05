'use client';
import { useEffect, useState } from 'react';
import { Plus, Send, Check, X, Play, Square } from 'lucide-react';
import { Section, EmptyState } from '@/components/pm/Shared.jsx';
import { FieldGroup, TextField, SelectField } from '@/components/ui/Field.jsx';
import { TextAreaField, DateField } from '@/components/pm/PmField.jsx';
import { StatusBadge } from '@/components/hse/StatusBadge.jsx';
import { PERMIT_TYPE_OPTIONS, optionLabel } from '@/lib/hseConstants.js';
import * as hseApi from '@/lib/hseApi.js';

const EMPTY = { permit_type: 'hot_work', activity: '', location: '', start_date: '', end_date: '', responsible: '', team_members: '', required_ppe: '', safety_conditions: '' };

export default function PermitsTab({ projectId }) {
  const [permits, setPermits] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function load() { const res = await hseApi.listPermits({ project_id: projectId, pageSize: 100 }); setPermits(res.rows); }
  useEffect(() => { load(); }, [projectId]);

  async function handleCreate(e) {
    e.preventDefault(); setSaving(true); setError(null);
    try { await hseApi.createPermit({ ...form, project_id: projectId }); setForm(EMPTY); setShowForm(false); load(); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function act(fn, id, ...args) {
    setError(null);
    try { await fn(id, ...args); load(); } catch (err) { setError(err.message); }
  }

  return (
    <Section title="تصاريح العمل" action={
      <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-1 rounded-sheet bg-navy-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-800">
        <Plus size={15} /> تصريح جديد
      </button>
    }>
      {error && <p className="mb-3 rounded-sheet bg-fail-50 p-2 text-sm text-fail-700">{error}</p>}
      {showForm && (
        <form onSubmit={handleCreate} className="mb-4 space-y-3 rounded-sheet border border-line bg-paper p-4">
          <FieldGroup cols={2}>
            <SelectField label="نوع العمل" value={form.permit_type} onChange={(v) => setForm({ ...form, permit_type: v })} options={PERMIT_TYPE_OPTIONS} />
            <TextField label="النشاط" value={form.activity} onChange={(v) => setForm({ ...form, activity: v })} />
            <TextField label="الموقع" value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
            <TextField label="المسؤول" value={form.responsible} onChange={(v) => setForm({ ...form, responsible: v })} />
            <DateField label="تاريخ البداية" value={form.start_date} onChange={(v) => setForm({ ...form, start_date: v })} required />
            <DateField label="تاريخ الانتهاء" value={form.end_date} onChange={(v) => setForm({ ...form, end_date: v })} required />
          </FieldGroup>
          <TextField label="الفريق المنفذ" value={form.team_members} onChange={(v) => setForm({ ...form, team_members: v })} />
          <TextAreaField label="معدات الوقاية المطلوبة" value={form.required_ppe} onChange={(v) => setForm({ ...form, required_ppe: v })} rows={2} />
          <TextAreaField label="شروط السلامة" value={form.safety_conditions} onChange={(v) => setForm({ ...form, safety_conditions: v })} rows={2} />
          <button type="submit" disabled={saving} className="rounded-sheet bg-navy-700 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-50">
            {saving ? 'جارٍ الحفظ...' : 'حفظ التصريح'}
          </button>
        </form>
      )}

      {permits.length === 0 ? <EmptyState title="لا تصاريح" message="أنشئ أول تصريح عمل لهذا المشروع." /> : (
        <div className="space-y-2">
          {permits.map((p) => (
            <div key={p.id} className="rounded-sheet border border-line bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">{p.permit_no} — {optionLabel(PERMIT_TYPE_OPTIONS, p.permit_type)}</p>
                  <p className="text-xs text-ink-soft">{p.start_date} → {p.end_date} {p.location ? `· ${p.location}` : ''}</p>
                </div>
                <StatusBadge status={p.status} small />
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                {p.status === 'draft' && (
                  <button onClick={() => act(hseApi.submitPermit, p.id)} className="flex items-center gap-1 text-navy-600 hover:underline"><Send size={12} /> إرسال للاعتماد</button>
                )}
                {p.status === 'pending_approval' && (
                  <>
                    <button onClick={() => act(hseApi.decidePermit, p.id, 'approved')} className="flex items-center gap-1 text-pass-700 hover:underline"><Check size={12} /> اعتماد</button>
                    <button onClick={() => act(hseApi.decidePermit, p.id, 'rejected')} className="flex items-center gap-1 text-fail-700 hover:underline"><X size={12} /> رفض</button>
                  </>
                )}
                {p.status === 'approved' && (
                  <button onClick={() => act(hseApi.activatePermit, p.id)} className="flex items-center gap-1 text-navy-600 hover:underline"><Play size={12} /> تفعيل</button>
                )}
                {['approved', 'active'].includes(p.status) && (
                  <button onClick={() => act(hseApi.closePermit, p.id)} className="flex items-center gap-1 text-ink-soft hover:underline"><Square size={12} /> إغلاق</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
