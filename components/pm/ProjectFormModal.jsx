'use client';
// components/pm/ProjectFormModal.jsx — نموذج إنشاء/تعديل مشروع بكل الحقول المطلوبة في مواصفة القسم الرابع.

import { useState } from 'react';
import { X } from 'lucide-react';
import { TextField, NumberField, SelectField, FieldGroup } from '@/components/ui/Field.jsx';
import { DateField, TextAreaField } from '@/components/pm/PmField.jsx';
import { pmProjects } from '@/lib/pmApi.js';

const STATUS_OPTIONS = [
  { value: 'planning', label: 'قيد التخطيط' }, { value: 'in_progress', label: 'قيد التنفيذ' },
  { value: 'stopped', label: 'متوقف' }, { value: 'completed', label: 'مكتمل' }, { value: 'cancelled', label: 'ملغي' },
];
const PRIORITY_OPTIONS = [
  { value: 'low', label: 'منخفضة' }, { value: 'medium', label: 'متوسطة' }, { value: 'high', label: 'عالية' }, { value: 'critical', label: 'حرجة' },
];

const EMPTY = {
  name: '', project_code: '', project_type: '', description: '',
  owner_name: '', contractor_name: '', subcontractor_name: '', consultant_name: '', project_manager_name: '', engineer_name: '', client_name: '',
  location: '', city: '', country: '', latitude: '', longitude: '',
  start_date: '', end_date: '', contract_value: '', budget: '', target_profit_pct: '', currency: 'SAR',
  status: 'planning', priority: 'medium',
};

export default function ProjectFormModal({ project, onClose, onSaved }) {
  const [form, setForm] = useState(project ? { ...EMPTY, ...project } : EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(key, value) { setForm((f) => ({ ...f, [key]: value })); }

  async function save() {
    if (!form.name?.trim()) { setError('اسم المشروع مطلوب.'); return; }
    setSaving(true); setError('');
    const res = project ? await pmProjects.update(project.id, form) : await pmProjects.create(form);
    setSaving(false);
    if (res.success) onSaved(res.project);
    else setError(res.error || 'تعذّر حفظ المشروع.');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-sheet border border-line bg-white shadow-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line sticky top-0 bg-white z-10">
          <h2 className="font-bold text-navy-700">{project ? 'تعديل المشروع' : 'مشروع جديد'}</h2>
          <button onClick={onClose}><X size={18} className="text-ink-soft" /></button>
        </div>
        <div className="p-5 space-y-5">
          {error && <div className="rounded-md bg-fail-50 border border-fail-100 text-fail-700 text-sm p-2.5">{error}</div>}

          <FieldGroup title="بيانات أساسية" cols={2}>
            <TextField label="اسم المشروع" value={form.name} onChange={(v) => set('name', v)} required />
            <TextField label="رقم المشروع" value={form.project_code} onChange={(v) => set('project_code', v)} placeholder="رقم تعريف فريد" />
            <TextField label="نوع المشروع" value={form.project_type} onChange={(v) => set('project_type', v)} placeholder="سكني، تجاري، بنية تحتية…" />
            <SelectField label="أولوية المشروع" value={form.priority} onChange={(v) => set('priority', v)} options={PRIORITY_OPTIONS} />
          </FieldGroup>
          <TextAreaField label="وصف المشروع" value={form.description} onChange={(v) => set('description', v)} rows={2} />

          <FieldGroup title="الأطراف المعنية" cols={2}>
            <TextField label="المالك" value={form.owner_name} onChange={(v) => set('owner_name', v)} />
            <TextField label="العميل" value={form.client_name} onChange={(v) => set('client_name', v)} />
            <TextField label="المقاول الرئيسي" value={form.contractor_name} onChange={(v) => set('contractor_name', v)} />
            <TextField label="المقاول الفرعي" value={form.subcontractor_name} onChange={(v) => set('subcontractor_name', v)} />
            <TextField label="المكتب الاستشاري" value={form.consultant_name} onChange={(v) => set('consultant_name', v)} />
            <TextField label="مدير المشروع" value={form.project_manager_name} onChange={(v) => set('project_manager_name', v)} />
            <TextField label="المهندس المسؤول" value={form.engineer_name} onChange={(v) => set('engineer_name', v)} />
          </FieldGroup>

          <FieldGroup title="الموقع" cols={2}>
            <TextField label="موقع المشروع" value={form.location} onChange={(v) => set('location', v)} />
            <TextField label="المدينة" value={form.city} onChange={(v) => set('city', v)} />
            <TextField label="الدولة" value={form.country} onChange={(v) => set('country', v)} />
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="خط العرض" value={form.latitude} onChange={(v) => set('latitude', v)} required={false} step="any" />
              <NumberField label="خط الطول" value={form.longitude} onChange={(v) => set('longitude', v)} required={false} step="any" />
            </div>
          </FieldGroup>

          <FieldGroup title="الجدول الزمني والحالة" cols={2}>
            <DateField label="تاريخ البداية" value={form.start_date} onChange={(v) => set('start_date', v)} />
            <DateField label="تاريخ النهاية" value={form.end_date} onChange={(v) => set('end_date', v)} />
            <SelectField label="حالة المشروع" value={form.status} onChange={(v) => set('status', v)} options={STATUS_OPTIONS} />
          </FieldGroup>

          <FieldGroup title="القيم المالية" cols={2}>
            <NumberField label="قيمة العقد" value={form.contract_value} onChange={(v) => set('contract_value', v)} unit={form.currency} required={false} />
            <NumberField label="الميزانية" value={form.budget} onChange={(v) => set('budget', v)} unit={form.currency} required={false} />
            <NumberField label="نسبة الربح المستهدفة" value={form.target_profit_pct} onChange={(v) => set('target_profit_pct', v)} unit="%" required={false} />
            <TextField label="العملة" value={form.currency} onChange={(v) => set('currency', v)} />
          </FieldGroup>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-line sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 rounded-md border border-line text-sm text-ink hover:bg-paper transition-colors">إلغاء</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-md bg-navy-700 text-white text-sm font-medium hover:bg-navy-800 disabled:opacity-60 transition-colors">
            {saving ? 'جارِ الحفظ…' : 'حفظ المشروع'}
          </button>
        </div>
      </div>
    </div>
  );
}
