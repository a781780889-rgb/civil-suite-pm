'use client';
import { useEffect, useState } from 'react';
import { Plus, Flame, Radiation } from 'lucide-react';
import { Section, EmptyState } from '@/components/pm/Shared.jsx';
import { FieldGroup, TextField, SelectField } from '@/components/ui/Field.jsx';
import { DateField, TextAreaField } from '@/components/pm/PmField.jsx';
import { StatusBadge } from '@/components/hse/StatusBadge.jsx';
import { HAZMAT_CATEGORY_OPTIONS, FIRE_EQUIPMENT_TYPE_OPTIONS, optionLabel } from '@/lib/hseConstants.js';
import * as hseApi from '@/lib/hseApi.js';

const SUB = [{ key: 'hazmat', label: 'المواد الخطرة', icon: Radiation }, { key: 'fire', label: 'معدات مكافحة الحريق', icon: Flame }];

export default function HazmatFireTab({ projectId }) {
  const [sub, setSub] = useState('hazmat');
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {SUB.map((s) => (
          <button key={s.key} onClick={() => setSub(s.key)} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${sub === s.key ? 'bg-navy-700 text-white' : 'bg-paper text-ink-soft'}`}>
            <s.icon size={14} /> {s.label}
          </button>
        ))}
      </div>
      {sub === 'hazmat' && <HazmatSection projectId={projectId} />}
      {sub === 'fire' && <FireSection projectId={projectId} />}
    </div>
  );
}

function HazmatSection({ projectId }) {
  const [rows, setRows] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ material_name: '', category: 'flammable', storage_location: '', usage_instructions: '', emergency_procedures: '', disposal_method: '' });

  async function load() { const res = await hseApi.listHazmat({ project_id: projectId }); setRows(res.materials); }
  useEffect(() => { load(); }, [projectId]);

  async function handleCreate(e) { e.preventDefault(); await hseApi.createHazmat({ ...form, project_id: projectId }); setShowForm(false); load(); }

  return (
    <Section title="سجل المواد الخطرة" action={
      <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-1 rounded-sheet bg-navy-700 px-3 py-1.5 text-sm font-medium text-white"><Plus size={15} /> مادة جديدة</button>
    }>
      {showForm && (
        <form onSubmit={handleCreate} className="mb-3 space-y-3 rounded-sheet border border-line bg-paper p-4">
          <FieldGroup cols={2}>
            <TextField label="اسم المادة" value={form.material_name} onChange={(v) => setForm({ ...form, material_name: v })} required />
            <SelectField label="التصنيف" value={form.category} onChange={(v) => setForm({ ...form, category: v })} options={HAZMAT_CATEGORY_OPTIONS} />
            <TextField label="مكان التخزين" value={form.storage_location} onChange={(v) => setForm({ ...form, storage_location: v })} />
          </FieldGroup>
          <TextAreaField label="تعليمات الاستخدام" value={form.usage_instructions} onChange={(v) => setForm({ ...form, usage_instructions: v })} rows={2} />
          <TextAreaField label="إجراءات الطوارئ" value={form.emergency_procedures} onChange={(v) => setForm({ ...form, emergency_procedures: v })} rows={2} />
          <TextField label="طريقة التخلص الآمن" value={form.disposal_method} onChange={(v) => setForm({ ...form, disposal_method: v })} />
          <button type="submit" className="rounded-sheet bg-navy-700 px-4 py-2 text-sm font-medium text-white">حفظ</button>
        </form>
      )}
      {rows.length === 0 ? <EmptyState title="لا مواد خطرة مسجَّلة" message="أضف أول مادة خطرة." /> : (
        <div className="grid gap-2 md:grid-cols-2">
          {rows.map((m) => (
            <div key={m.id} className="rounded-sheet border border-line bg-white p-3">
              <p className="font-medium text-ink">{m.material_name}</p>
              <p className="text-xs text-ink-soft">{optionLabel(HAZMAT_CATEGORY_OPTIONS, m.category)} {m.storage_location ? `· ${m.storage_location}` : ''}</p>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function FireSection({ projectId }) {
  const [rows, setRows] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [checkingId, setCheckingId] = useState(null);
  const [checkForm, setCheckForm] = useState({ check_date: '', result: 'pass', next_due_date: '' });
  const [form, setForm] = useState({ equipment_type: 'extinguisher', location: '', install_date: '' });

  async function load() { const res = await hseApi.listFireEquipment({ project_id: projectId, pageSize: 100 }); setRows(res.rows); }
  useEffect(() => { load(); }, [projectId]);

  async function handleCreate(e) { e.preventDefault(); await hseApi.createFireEquipment({ ...form, project_id: projectId }); setShowForm(false); load(); }
  async function saveCheck(id) { await hseApi.recordFireEquipmentCheck(id, checkForm); setCheckingId(null); load(); }

  return (
    <Section title="معدات مكافحة الحريق" action={
      <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-1 rounded-sheet bg-navy-700 px-3 py-1.5 text-sm font-medium text-white"><Plus size={15} /> معدة جديدة</button>
    }>
      {showForm && (
        <form onSubmit={handleCreate} className="mb-3 space-y-3 rounded-sheet border border-line bg-paper p-4">
          <FieldGroup cols={2}>
            <SelectField label="النوع" value={form.equipment_type} onChange={(v) => setForm({ ...form, equipment_type: v })} options={FIRE_EQUIPMENT_TYPE_OPTIONS} />
            <TextField label="الموقع" value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
            <DateField label="تاريخ التركيب" value={form.install_date} onChange={(v) => setForm({ ...form, install_date: v })} />
          </FieldGroup>
          <button type="submit" className="rounded-sheet bg-navy-700 px-4 py-2 text-sm font-medium text-white">حفظ</button>
        </form>
      )}
      {rows.length === 0 ? <EmptyState title="لا معدات إطفاء" message="أضف أول معدة مكافحة حريق." /> : (
        <div className="space-y-2">
          {rows.map((eq) => (
            <div key={eq.id} className="rounded-sheet border border-line bg-white p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-ink">{optionLabel(FIRE_EQUIPMENT_TYPE_OPTIONS, eq.equipment_type)}</p>
                  <p className="text-xs text-ink-soft">{eq.location} {eq.next_inspection_date ? `· الفحص القادم: ${eq.next_inspection_date}` : ''}</p>
                </div>
                <StatusBadge status={eq.status} small />
              </div>
              {checkingId === eq.id ? (
                <div className="mt-2 flex flex-wrap items-end gap-2 rounded-sheet bg-paper p-2">
                  <DateField label="تاريخ الفحص" value={checkForm.check_date} onChange={(v) => setCheckForm({ ...checkForm, check_date: v })} />
                  <SelectField label="النتيجة" value={checkForm.result} onChange={(v) => setCheckForm({ ...checkForm, result: v })} options={[{ value: 'pass', label: 'ناجح' }, { value: 'fail', label: 'راسب' }]} />
                  <DateField label="الفحص القادم" value={checkForm.next_due_date} onChange={(v) => setCheckForm({ ...checkForm, next_due_date: v })} />
                  <button onClick={() => saveCheck(eq.id)} className="rounded-sheet bg-navy-700 px-3 py-2 text-xs font-medium text-white">حفظ</button>
                </div>
              ) : (
                <button onClick={() => setCheckingId(eq.id)} className="mt-2 text-xs text-navy-600 hover:underline">تسجيل فحص دوري</button>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
