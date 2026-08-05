'use client';
import { useEffect, useState } from 'react';
import { Plus, HardHat, GraduationCap } from 'lucide-react';
import { Section, EmptyState } from '@/components/pm/Shared.jsx';
import { FieldGroup, TextField, SelectField, NumberField } from '@/components/ui/Field.jsx';
import { DateField } from '@/components/pm/PmField.jsx';
import { StatusBadge } from '@/components/hse/StatusBadge.jsx';
import { PPE_TYPE_OPTIONS, optionLabel } from '@/lib/hseConstants.js';
import * as hseApi from '@/lib/hseApi.js';

const SUB = [{ key: 'ppe', label: 'معدات الوقاية', icon: HardHat }, { key: 'training', label: 'التدريب والشهادات', icon: GraduationCap }];

export default function PpeTrainingTab({ projectId }) {
  const [sub, setSub] = useState('ppe');
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {SUB.map((s) => (
          <button key={s.key} onClick={() => setSub(s.key)} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${sub === s.key ? 'bg-navy-700 text-white' : 'bg-paper text-ink-soft'}`}>
            <s.icon size={14} /> {s.label}
          </button>
        ))}
      </div>
      {sub === 'ppe' && <PpeSection projectId={projectId} />}
      {sub === 'training' && <TrainingSection projectId={projectId} />}
    </div>
  );
}

function PpeSection({ projectId }) {
  const [items, setItems] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [showItemForm, setShowItemForm] = useState(false);
  const [showDistForm, setShowDistForm] = useState(false);
  const [itemForm, setItemForm] = useState({ item_type: 'helmet', item_name: '', quantity_on_hand: 0, min_stock: 5 });
  const [distForm, setDistForm] = useState({ ppe_item_id: '', employee_name: '', quantity: 1, issue_date: '' });
  const [error, setError] = useState(null);

  async function load() {
    const [i, d] = await Promise.all([hseApi.listPpeItems({}), hseApi.listPpeDistributions({ project_id: projectId, pageSize: 100 })]);
    setItems(i.items); setDistributions(d.rows);
  }
  useEffect(() => { load(); }, [projectId]);

  async function createItem(e) { e.preventDefault(); await hseApi.createPpeItem(itemForm); setShowItemForm(false); load(); }
  async function distribute(e) {
    e.preventDefault(); setError(null);
    try { await hseApi.distributePpe({ ...distForm, project_id: projectId, ppe_item_id: Number(distForm.ppe_item_id) }); setShowDistForm(false); load(); }
    catch (err) { setError(err.message); }
  }

  return (
    <div className="space-y-4">
      <Section title="مخزون معدات الوقاية" action={
        <button onClick={() => setShowItemForm((v) => !v)} className="flex items-center gap-1 rounded-sheet bg-navy-700 px-3 py-1.5 text-sm font-medium text-white"><Plus size={15} /> صنف جديد</button>
      }>
        {showItemForm && (
          <form onSubmit={createItem} className="mb-3 space-y-3 rounded-sheet border border-line bg-paper p-4">
            <FieldGroup cols={2}>
              <SelectField label="النوع" value={itemForm.item_type} onChange={(v) => setItemForm({ ...itemForm, item_type: v })} options={PPE_TYPE_OPTIONS} />
              <TextField label="اسم الصنف" value={itemForm.item_name} onChange={(v) => setItemForm({ ...itemForm, item_name: v })} required />
              <NumberField label="الكمية الحالية" value={itemForm.quantity_on_hand} onChange={(v) => setItemForm({ ...itemForm, quantity_on_hand: Number(v) })} min={0} step={1} />
              <NumberField label="الحد الأدنى" value={itemForm.min_stock} onChange={(v) => setItemForm({ ...itemForm, min_stock: Number(v) })} min={0} step={1} />
            </FieldGroup>
            <button type="submit" className="rounded-sheet bg-navy-700 px-4 py-2 text-sm font-medium text-white">حفظ</button>
          </form>
        )}
        <div className="grid gap-2 md:grid-cols-3">
          {items.map((it) => (
            <div key={it.id} className={`rounded-sheet border p-3 ${it.quantity_on_hand <= it.min_stock ? 'border-warnclr-200 bg-warnclr-50' : 'border-line bg-white'}`}>
              <p className="font-medium text-ink">{it.item_name}</p>
              <p className="text-xs text-ink-soft">{optionLabel(PPE_TYPE_OPTIONS, it.item_type)}</p>
              <p className="mt-1 text-sm">المتوفر: <span className="font-semibold">{it.quantity_on_hand}</span> / حد أدنى {it.min_stock}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="توزيع معدات الوقاية" action={
        <button onClick={() => setShowDistForm((v) => !v)} className="flex items-center gap-1 rounded-sheet bg-navy-700 px-3 py-1.5 text-sm font-medium text-white"><Plus size={15} /> تسليم جديد</button>
      }>
        {error && <p className="mb-3 rounded-sheet bg-fail-50 p-2 text-sm text-fail-700">{error}</p>}
        {showDistForm && (
          <form onSubmit={distribute} className="mb-3 space-y-3 rounded-sheet border border-line bg-paper p-4">
            <FieldGroup cols={2}>
              <SelectField label="الصنف" value={distForm.ppe_item_id} onChange={(v) => setDistForm({ ...distForm, ppe_item_id: v })} options={items.map((i) => ({ value: String(i.id), label: `${i.item_name} (${i.quantity_on_hand} متوفر)` }))} />
              <TextField label="الموظف المستلم" value={distForm.employee_name} onChange={(v) => setDistForm({ ...distForm, employee_name: v })} required />
              <NumberField label="الكمية" value={distForm.quantity} onChange={(v) => setDistForm({ ...distForm, quantity: Number(v) })} min={1} step={1} />
              <DateField label="تاريخ التسليم" value={distForm.issue_date} onChange={(v) => setDistForm({ ...distForm, issue_date: v })} required />
            </FieldGroup>
            <button type="submit" className="rounded-sheet bg-navy-700 px-4 py-2 text-sm font-medium text-white">تسليم</button>
          </form>
        )}
        {distributions.length === 0 ? <EmptyState title="لا سجلات تسليم" message="لم يُسلَّم أي معدات وقاية بعد." /> : (
          <div className="space-y-1.5">
            {distributions.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-sheet border border-line bg-white p-2.5 text-sm">
                <span>{d.employee_name} — {d.item_name} ×{d.quantity}</span>
                <StatusBadge status={d.status} small />
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function TrainingSection({ projectId }) {
  const [courses, setCourses] = useState([]);
  const [certs, setCerts] = useState([]);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [showCertForm, setShowCertForm] = useState(false);
  const [courseForm, setCourseForm] = useState({ course_name: '', provider: '', course_date: '', validity_days: 365 });
  const [certForm, setCertForm] = useState({ course_id: '', trainee_name: '', issued_date: '' });

  async function load() {
    const [c, k] = await Promise.all([hseApi.listTrainingCourses({ project_id: projectId }), hseApi.listCertifications({ pageSize: 100 })]);
    setCourses(c.courses); setCerts(k.rows);
  }
  useEffect(() => { load(); }, [projectId]);

  async function createCourse(e) { e.preventDefault(); await hseApi.createTrainingCourse({ ...courseForm, project_id: projectId }); setShowCourseForm(false); load(); }
  async function issueCert(e) { e.preventDefault(); await hseApi.issueCertification({ ...certForm, course_id: Number(certForm.course_id) }); setShowCertForm(false); load(); }

  return (
    <div className="space-y-4">
      <Section title="دورات السلامة" action={
        <button onClick={() => setShowCourseForm((v) => !v)} className="flex items-center gap-1 rounded-sheet bg-navy-700 px-3 py-1.5 text-sm font-medium text-white"><Plus size={15} /> دورة جديدة</button>
      }>
        {showCourseForm && (
          <form onSubmit={createCourse} className="mb-3 space-y-3 rounded-sheet border border-line bg-paper p-4">
            <FieldGroup cols={2}>
              <TextField label="اسم الدورة" value={courseForm.course_name} onChange={(v) => setCourseForm({ ...courseForm, course_name: v })} required />
              <TextField label="الجهة المقدِّمة" value={courseForm.provider} onChange={(v) => setCourseForm({ ...courseForm, provider: v })} />
              <DateField label="تاريخ الدورة" value={courseForm.course_date} onChange={(v) => setCourseForm({ ...courseForm, course_date: v })} required />
              <NumberField label="مدة الصلاحية (أيام)" value={courseForm.validity_days} onChange={(v) => setCourseForm({ ...courseForm, validity_days: Number(v) })} min={1} step={1} />
            </FieldGroup>
            <button type="submit" className="rounded-sheet bg-navy-700 px-4 py-2 text-sm font-medium text-white">حفظ</button>
          </form>
        )}
        {courses.length === 0 ? <EmptyState title="لا دورات" message="أضف أول دورة سلامة." /> : (
          <div className="grid gap-2 md:grid-cols-2">
            {courses.map((c) => <div key={c.id} className="rounded-sheet border border-line bg-white p-2.5 text-sm"><p className="font-medium">{c.course_name}</p><p className="text-xs text-ink-soft">{c.provider} · {c.course_date}</p></div>)}
          </div>
        )}
      </Section>

      <Section title="الشهادات" action={
        <button onClick={() => setShowCertForm((v) => !v)} className="flex items-center gap-1 rounded-sheet bg-navy-700 px-3 py-1.5 text-sm font-medium text-white"><Plus size={15} /> إصدار شهادة</button>
      }>
        {showCertForm && (
          <form onSubmit={issueCert} className="mb-3 space-y-3 rounded-sheet border border-line bg-paper p-4">
            <FieldGroup cols={2}>
              <SelectField label="الدورة" value={certForm.course_id} onChange={(v) => setCertForm({ ...certForm, course_id: v })} options={courses.map((c) => ({ value: String(c.id), label: c.course_name }))} />
              <TextField label="اسم المتدرب" value={certForm.trainee_name} onChange={(v) => setCertForm({ ...certForm, trainee_name: v })} required />
              <DateField label="تاريخ الإصدار" value={certForm.issued_date} onChange={(v) => setCertForm({ ...certForm, issued_date: v })} required />
            </FieldGroup>
            <button type="submit" className="rounded-sheet bg-navy-700 px-4 py-2 text-sm font-medium text-white">إصدار</button>
          </form>
        )}
        {certs.length === 0 ? <EmptyState title="لا شهادات" message="لم تُصدَر شهادات بعد." /> : (
          <div className="space-y-1.5">
            {certs.map((k) => (
              <div key={k.id} className="flex items-center justify-between rounded-sheet border border-line bg-white p-2.5 text-sm">
                <span>{k.trainee_name} — {k.course_name}</span>
                <StatusBadge status={k.status} small />
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
