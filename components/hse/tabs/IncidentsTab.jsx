'use client';
import { useEffect, useState } from 'react';
import { Plus, FileSearch, Link2, Lock } from 'lucide-react';
import { Section, EmptyState } from '@/components/pm/Shared.jsx';
import { FieldGroup, TextField, SelectField } from '@/components/ui/Field.jsx';
import { DateField, TextAreaField } from '@/components/pm/PmField.jsx';
import { StatusBadge, SeverityBadge } from '@/components/hse/StatusBadge.jsx';
import { INCIDENT_TYPE_OPTIONS, VIOLATION_TYPE_OPTIONS, SEVERITY_OPTIONS, optionLabel } from '@/lib/hseConstants.js';
import * as hseApi from '@/lib/hseApi.js';

const SUB = [{ key: 'incidents', label: 'الحوادث' }, { key: 'near_miss', label: 'بلاغات قريبة من حادث' }, { key: 'violations', label: 'المخالفات' }];

export default function IncidentsTab({ projectId }) {
  const [sub, setSub] = useState('incidents');
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {SUB.map((s) => (
          <button key={s.key} onClick={() => setSub(s.key)} className={`rounded-full px-3 py-1.5 text-sm font-medium ${sub === s.key ? 'bg-navy-700 text-white' : 'bg-paper text-ink-soft'}`}>
            {s.label}
          </button>
        ))}
      </div>
      {sub === 'incidents' && <IncidentsSection projectId={projectId} />}
      {sub === 'near_miss' && <NearMissSection projectId={projectId} />}
      {sub === 'violations' && <ViolationsSection projectId={projectId} />}
    </div>
  );
}

function IncidentsSection({ projectId }) {
  const [rows, setRows] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [form, setForm] = useState({ incident_type: 'first_aid_injury', incident_date: '', location: '', description: '', immediate_cause: '' });
  const [investForm, setInvestForm] = useState({ root_cause: '', investigation_notes: '', investigation_status: 'in_progress' });
  const [error, setError] = useState(null);

  async function load() { const res = await hseApi.listIncidents({ project_id: projectId, pageSize: 100 }); setRows(res.rows); }
  useEffect(() => { load(); }, [projectId]);

  async function handleCreate(e) {
    e.preventDefault(); setError(null);
    try { await hseApi.createIncident({ ...form, project_id: projectId }); setShowForm(false); load(); }
    catch (err) { setError(err.message); }
  }

  async function saveInvestigation(id) {
    setError(null);
    try { await hseApi.updateIncidentInvestigation(id, investForm); load(); }
    catch (err) { setError(err.message); }
  }

  async function close(id) {
    setError(null);
    try { await hseApi.closeIncident(id); load(); } catch (err) { setError(err.message); }
  }

  return (
    <Section title="سجل الحوادث والإصابات" action={
      <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-1 rounded-sheet bg-fail-DEFAULT px-3 py-1.5 text-sm font-medium text-white">
        <Plus size={15} /> تسجيل حادث
      </button>
    }>
      {error && <p className="mb-3 rounded-sheet bg-fail-50 p-2 text-sm text-fail-700">{error}</p>}
      {showForm && (
        <form onSubmit={handleCreate} className="mb-4 space-y-3 rounded-sheet border border-line bg-paper p-4">
          <FieldGroup cols={2}>
            <SelectField label="نوع الحادث" value={form.incident_type} onChange={(v) => setForm({ ...form, incident_type: v })} options={INCIDENT_TYPE_OPTIONS} />
            <DateField label="تاريخ الحادث" value={form.incident_date} onChange={(v) => setForm({ ...form, incident_date: v })} required />
            <TextField label="الموقع" value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
            <TextField label="السبب المباشر" value={form.immediate_cause} onChange={(v) => setForm({ ...form, immediate_cause: v })} />
          </FieldGroup>
          <TextAreaField label="وصف الحادث" value={form.description} onChange={(v) => setForm({ ...form, description: v })} rows={3} />
          <button type="submit" className="rounded-sheet bg-fail-DEFAULT px-4 py-2 text-sm font-medium text-white">حفظ الحادث</button>
        </form>
      )}
      {rows.length === 0 ? <EmptyState title="لا حوادث" message="لم تُسجَّل أي حوادث - وهذا جيد." /> : (
        <div className="space-y-2">
          {rows.map((i) => (
            <div key={i.id} className="rounded-sheet border border-line bg-white p-3">
              <div className="flex items-center justify-between">
                <button onClick={() => setExpanded(expanded === i.id ? null : i.id)} className="text-right font-semibold text-ink hover:underline">
                  {i.incident_no} — {optionLabel(INCIDENT_TYPE_OPTIONS, i.incident_type)}
                </button>
                <StatusBadge status={i.status} small />
              </div>
              <p className="text-xs text-ink-soft">{i.incident_date} {i.location ? `· ${i.location}` : ''} · مصابون: {i.affected_persons.length}</p>
              {expanded === i.id && i.status !== 'closed' && (
                <div className="mt-3 space-y-2 border-t border-line pt-3">
                  <TextAreaField label="ملاحظات التحقيق" value={investForm.investigation_notes} onChange={(v) => setInvestForm({ ...investForm, investigation_notes: v })} rows={2} />
                  <TextField label="السبب الجذري" value={investForm.root_cause} onChange={(v) => setInvestForm({ ...investForm, root_cause: v })} />
                  <SelectField label="حالة التحقيق" value={investForm.investigation_status} onChange={(v) => setInvestForm({ ...investForm, investigation_status: v })} options={[{ value: 'in_progress', label: 'قيد التنفيذ' }, { value: 'completed', label: 'مكتمل' }]} />
                  <div className="flex gap-3">
                    <button onClick={() => saveInvestigation(i.id)} className="flex items-center gap-1 rounded-sheet bg-navy-700 px-3 py-1.5 text-xs font-medium text-white"><FileSearch size={13} /> حفظ التحقيق</button>
                    {i.investigation_status === 'completed' && (
                      <button onClick={() => close(i.id)} className="flex items-center gap-1 rounded-sheet bg-concrete-300 px-3 py-1.5 text-xs font-medium text-ink"><Lock size={13} /> إغلاق الحادث</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function NearMissSection({ projectId }) {
  const [rows, setRows] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ description: '', location: '', cause: '', risk_level: 'low' });

  async function load() { const res = await hseApi.listNearMisses({ project_id: projectId, pageSize: 100 }); setRows(res.rows); }
  useEffect(() => { load(); }, [projectId]);

  async function handleCreate(e) { e.preventDefault(); await hseApi.createNearMiss({ ...form, project_id: projectId }); setShowForm(false); setForm({ description: '', location: '', cause: '', risk_level: 'low' }); load(); }
  async function close(id) { await hseApi.closeNearMiss(id); load(); }

  return (
    <Section title="بلاغات قريبة من حادث (Near Miss)" action={
      <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-1 rounded-sheet bg-navy-700 px-3 py-1.5 text-sm font-medium text-white"><Plus size={15} /> بلاغ جديد</button>
    }>
      {showForm && (
        <form onSubmit={handleCreate} className="mb-4 space-y-3 rounded-sheet border border-line bg-paper p-4">
          <FieldGroup cols={2}>
            <TextField label="الموقع" value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
            <SelectField label="مستوى الخطورة" value={form.risk_level} onChange={(v) => setForm({ ...form, risk_level: v })} options={SEVERITY_OPTIONS} />
          </FieldGroup>
          <TextAreaField label="وصف الحالة" value={form.description} onChange={(v) => setForm({ ...form, description: v })} rows={2} required />
          <TextField label="السبب" value={form.cause} onChange={(v) => setForm({ ...form, cause: v })} />
          <button type="submit" className="rounded-sheet bg-navy-700 px-4 py-2 text-sm font-medium text-white">حفظ</button>
        </form>
      )}
      {rows.length === 0 ? <EmptyState title="لا بلاغات" message="شجّع فريق العمل على الإبلاغ المبكر." /> : (
        <div className="space-y-2">
          {rows.map((n) => (
            <div key={n.id} className="flex items-center justify-between rounded-sheet border border-line bg-white p-3">
              <div>
                <p className="font-medium text-ink">{n.near_miss_no} — {n.description}</p>
                <p className="text-xs text-ink-soft">{n.location}</p>
              </div>
              <div className="flex items-center gap-2">
                <SeverityBadge severity={n.risk_level} small />
                {n.status === 'open' ? <button onClick={() => close(n.id)} className="text-xs text-navy-600 hover:underline">إغلاق</button> : <StatusBadge status={n.status} small />}
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function ViolationsSection({ projectId }) {
  const [rows, setRows] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ violation_type: 'unsafe_act', severity: 'medium', responsible_person: '', location: '', violation_date: '' });

  async function load() { const res = await hseApi.listViolations({ project_id: projectId, pageSize: 100 }); setRows(res.rows); }
  useEffect(() => { load(); }, [projectId]);

  async function handleCreate(e) { e.preventDefault(); await hseApi.createViolation({ ...form, project_id: projectId }); setShowForm(false); load(); }
  async function close(id) { await hseApi.closeViolation(id); load(); }

  return (
    <Section title="المخالفات" action={
      <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-1 rounded-sheet bg-navy-700 px-3 py-1.5 text-sm font-medium text-white"><Plus size={15} /> تسجيل مخالفة</button>
    }>
      {showForm && (
        <form onSubmit={handleCreate} className="mb-4 space-y-3 rounded-sheet border border-line bg-paper p-4">
          <FieldGroup cols={2}>
            <SelectField label="نوع المخالفة" value={form.violation_type} onChange={(v) => setForm({ ...form, violation_type: v })} options={VIOLATION_TYPE_OPTIONS} />
            <SelectField label="الخطورة" value={form.severity} onChange={(v) => setForm({ ...form, severity: v })} options={SEVERITY_OPTIONS} />
            <TextField label="الشخص المسؤول" value={form.responsible_person} onChange={(v) => setForm({ ...form, responsible_person: v })} />
            <TextField label="الموقع" value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
            <DateField label="تاريخ المخالفة" value={form.violation_date} onChange={(v) => setForm({ ...form, violation_date: v })} required />
          </FieldGroup>
          <button type="submit" className="rounded-sheet bg-navy-700 px-4 py-2 text-sm font-medium text-white">حفظ</button>
        </form>
      )}
      {rows.length === 0 ? <EmptyState title="لا مخالفات" message="لا مخالفات مسجَّلة حالياً." /> : (
        <div className="space-y-2">
          {rows.map((v) => (
            <div key={v.id} className="flex items-center justify-between rounded-sheet border border-line bg-white p-3">
              <div className="flex items-center gap-2">
                <Link2 size={14} className="text-ink-soft" />
                <div>
                  <p className="font-medium text-ink">{v.violation_no} — {optionLabel(VIOLATION_TYPE_OPTIONS, v.violation_type)}</p>
                  <p className="text-xs text-ink-soft">{v.violation_date} {v.responsible_person ? `· ${v.responsible_person}` : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <SeverityBadge severity={v.severity} small />
                {v.status === 'open' ? <button onClick={() => close(v.id)} className="text-xs text-navy-600 hover:underline">إغلاق</button> : <StatusBadge status={v.status} small />}
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
