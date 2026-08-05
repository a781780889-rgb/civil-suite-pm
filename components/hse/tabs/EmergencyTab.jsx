'use client';
import { useEffect, useState } from 'react';
import { Plus, DoorOpen, Users, Siren as DrillIcon, FileText, Upload } from 'lucide-react';
import { Section, EmptyState } from '@/components/pm/Shared.jsx';
import { FieldGroup, TextField, SelectField, NumberField } from '@/components/ui/Field.jsx';
import { DateField, TextAreaField } from '@/components/pm/PmField.jsx';
import { EMERGENCY_PLAN_TYPE_OPTIONS, EMERGENCY_TEAM_TYPE_OPTIONS, HSE_DOCUMENT_CATEGORY_OPTIONS, optionLabel } from '@/lib/hseConstants.js';
import * as hseApi from '@/lib/hseApi.js';

const SUB = [
  { key: 'plans', label: 'خطط الطوارئ', icon: DoorOpen }, { key: 'teams', label: 'فرق الطوارئ', icon: Users },
  { key: 'drills', label: 'تدريبات الإخلاء', icon: DrillIcon }, { key: 'documents', label: 'خطط السلامة (مستندات)', icon: FileText },
];

export default function EmergencyTab({ projectId }) {
  const [sub, setSub] = useState('plans');
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {SUB.map((s) => (
          <button key={s.key} onClick={() => setSub(s.key)} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${sub === s.key ? 'bg-navy-700 text-white' : 'bg-paper text-ink-soft'}`}>
            <s.icon size={14} /> {s.label}
          </button>
        ))}
      </div>
      {sub === 'plans' && <PlansSection projectId={projectId} />}
      {sub === 'teams' && <TeamsSection projectId={projectId} />}
      {sub === 'drills' && <DrillsSection projectId={projectId} />}
      {sub === 'documents' && <DocumentsSection projectId={projectId} />}
    </div>
  );
}

function PlansSection({ projectId }) {
  const [rows, setRows] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ plan_type: 'evacuation', title: '', scenario: '', assembly_points: '' });

  async function load() { const res = await hseApi.listEmergencyPlans({ project_id: projectId }); setRows(res.plans); }
  useEffect(() => { load(); }, [projectId]);
  async function handleCreate(e) { e.preventDefault(); await hseApi.createEmergencyPlan({ ...form, project_id: projectId }); setShowForm(false); load(); }

  return (
    <Section title="خطط الطوارئ" action={<button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-1 rounded-sheet bg-navy-700 px-3 py-1.5 text-sm font-medium text-white"><Plus size={15} /> خطة جديدة</button>}>
      {showForm && (
        <form onSubmit={handleCreate} className="mb-3 space-y-3 rounded-sheet border border-line bg-paper p-4">
          <FieldGroup cols={2}>
            <SelectField label="نوع الخطة" value={form.plan_type} onChange={(v) => setForm({ ...form, plan_type: v })} options={EMERGENCY_PLAN_TYPE_OPTIONS} />
            <TextField label="العنوان" value={form.title} onChange={(v) => setForm({ ...form, title: v })} required />
          </FieldGroup>
          <TextAreaField label="السيناريو" value={form.scenario} onChange={(v) => setForm({ ...form, scenario: v })} rows={2} />
          <TextAreaField label="نقاط التجمع" value={form.assembly_points} onChange={(v) => setForm({ ...form, assembly_points: v })} rows={2} />
          <button type="submit" className="rounded-sheet bg-navy-700 px-4 py-2 text-sm font-medium text-white">حفظ</button>
        </form>
      )}
      {rows.length === 0 ? <EmptyState title="لا خطط طوارئ" message="أضف أول خطة طوارئ لهذا المشروع." /> : (
        <div className="grid gap-2 md:grid-cols-2">
          {rows.map((p) => (
            <div key={p.id} className="rounded-sheet border border-line bg-white p-3">
              <p className="font-medium text-ink">{p.title}</p>
              <p className="text-xs text-ink-soft">{optionLabel(EMERGENCY_PLAN_TYPE_OPTIONS, p.plan_type)} · إصدار {p.version}</p>
              {p.assembly_points && <p className="mt-1 text-xs text-ink-soft">نقاط التجمع: {p.assembly_points}</p>}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function TeamsSection({ projectId }) {
  const [rows, setRows] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ team_name: '', team_type: 'evacuation', membersText: '' });

  async function load() { const res = await hseApi.listEmergencyTeams(projectId); setRows(res.teams); }
  useEffect(() => { load(); }, [projectId]);
  async function handleCreate(e) {
    e.preventDefault();
    const members = form.membersText.split('\n').map((n) => n.trim()).filter(Boolean).map((name) => ({ name }));
    await hseApi.createEmergencyTeam({ project_id: projectId, team_name: form.team_name, team_type: form.team_type, members });
    setShowForm(false); load();
  }

  return (
    <Section title="فرق الطوارئ" action={<button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-1 rounded-sheet bg-navy-700 px-3 py-1.5 text-sm font-medium text-white"><Plus size={15} /> فريق جديد</button>}>
      {showForm && (
        <form onSubmit={handleCreate} className="mb-3 space-y-3 rounded-sheet border border-line bg-paper p-4">
          <FieldGroup cols={2}>
            <TextField label="اسم الفريق" value={form.team_name} onChange={(v) => setForm({ ...form, team_name: v })} required />
            <SelectField label="النوع" value={form.team_type} onChange={(v) => setForm({ ...form, team_type: v })} options={EMERGENCY_TEAM_TYPE_OPTIONS} />
          </FieldGroup>
          <TextAreaField label="الأعضاء (سطر لكل اسم)" value={form.membersText} onChange={(v) => setForm({ ...form, membersText: v })} rows={3} />
          <button type="submit" className="rounded-sheet bg-navy-700 px-4 py-2 text-sm font-medium text-white">حفظ</button>
        </form>
      )}
      {rows.length === 0 ? <EmptyState title="لا فرق طوارئ" message="شكّل أول فريق طوارئ." /> : (
        <div className="grid gap-2 md:grid-cols-2">
          {rows.map((t) => (
            <div key={t.id} className="rounded-sheet border border-line bg-white p-3">
              <p className="font-medium text-ink">{t.team_name}</p>
              <p className="text-xs text-ink-soft">{optionLabel(EMERGENCY_TEAM_TYPE_OPTIONS, t.team_type)} · {t.members.length} أعضاء</p>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function DrillsSection({ projectId }) {
  const [rows, setRows] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ drill_date: '', scenario: '', participants_count: '', response_time_minutes: '', evaluation_notes: '' });

  async function load() { const res = await hseApi.listEmergencyDrills(projectId); setRows(res.drills); }
  useEffect(() => { load(); }, [projectId]);
  async function handleCreate(e) { e.preventDefault(); await hseApi.recordEmergencyDrill({ ...form, project_id: projectId }); setShowForm(false); load(); }

  return (
    <Section title="تدريبات الإخلاء" action={<button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-1 rounded-sheet bg-navy-700 px-3 py-1.5 text-sm font-medium text-white"><Plus size={15} /> تسجيل تدريب</button>}>
      {showForm && (
        <form onSubmit={handleCreate} className="mb-3 space-y-3 rounded-sheet border border-line bg-paper p-4">
          <FieldGroup cols={2}>
            <DateField label="تاريخ التدريب" value={form.drill_date} onChange={(v) => setForm({ ...form, drill_date: v })} required />
            <NumberField label="عدد المشاركين" value={form.participants_count} onChange={(v) => setForm({ ...form, participants_count: v })} min={0} step={1} />
            <NumberField label="زمن الاستجابة (دقائق)" value={form.response_time_minutes} onChange={(v) => setForm({ ...form, response_time_minutes: v })} min={0} step={0.5} />
          </FieldGroup>
          <TextAreaField label="ملاحظات التقييم" value={form.evaluation_notes} onChange={(v) => setForm({ ...form, evaluation_notes: v })} rows={2} />
          <button type="submit" className="rounded-sheet bg-navy-700 px-4 py-2 text-sm font-medium text-white">حفظ</button>
        </form>
      )}
      {rows.length === 0 ? <EmptyState title="لا تدريبات" message="سجّل أول تدريب إخلاء." /> : (
        <div className="space-y-1.5">
          {rows.map((d) => (
            <div key={d.id} className="rounded-sheet border border-line bg-white p-2.5 text-sm">
              {d.drill_date} — مشاركون: {d.participants_count ?? '-'} — زمن الاستجابة: {d.response_time_minutes ?? '-'} دقيقة
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function DocumentsSection({ projectId }) {
  const [rows, setRows] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState('hse_safety_plan');
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  async function load() { const res = await hseApi.listSafetyPlans({ project_id: projectId }); setRows(res.documents); }
  useEffect(() => { load(); }, [projectId]);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set('project_id', projectId); fd.set('category', category); fd.set('name', name || file.name); fd.set('file', file);
      await hseApi.createSafetyPlan(fd);
      setShowForm(false); setFile(null); setName(''); load();
    } finally { setUploading(false); }
  }

  return (
    <Section title="خطط وسياسات السلامة (مستندات رسمية بإصدارات)" action={
      <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-1 rounded-sheet bg-navy-700 px-3 py-1.5 text-sm font-medium text-white"><Plus size={15} /> رفع مستند</button>
    }>
      {showForm && (
        <form onSubmit={handleUpload} className="mb-3 space-y-3 rounded-sheet border border-line bg-paper p-4">
          <FieldGroup cols={2}>
            <SelectField label="التصنيف" value={category} onChange={setCategory} options={HSE_DOCUMENT_CATEGORY_OPTIONS} />
            <TextField label="اسم المستند" value={name} onChange={setName} />
          </FieldGroup>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">الملف</label>
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block w-full text-sm" required />
          </div>
          <button type="submit" disabled={uploading} className="flex items-center gap-1.5 rounded-sheet bg-navy-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            <Upload size={14} /> {uploading ? 'جارٍ الرفع...' : 'رفع'}
          </button>
        </form>
      )}
      {rows.length === 0 ? <EmptyState icon={FileText} title="لا مستندات" message="ارفع خطة السلامة أو سياسة أو إجراء عمل آمن." /> : (
        <div className="grid gap-2 md:grid-cols-2">
          {rows.map((d) => (
            <div key={d.id} className="rounded-sheet border border-line bg-white p-3">
              <p className="font-medium text-ink">{d.name}</p>
              <p className="text-xs text-ink-soft">{optionLabel(HSE_DOCUMENT_CATEGORY_OPTIONS, d.category)} · إصدار {d.version} · {d.status === 'approved' ? 'معتمَد' : 'بانتظار الاعتماد'}</p>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
