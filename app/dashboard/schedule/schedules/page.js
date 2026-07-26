'use client';
// app/dashboard/schedule/schedules/page.js — قائمة كل الجداول الزمنية عبر المشاريع + إنشاء جدول جديد مرتبط بمشروع قائم.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, CalendarRange, ArrowLeft, Star, Archive } from 'lucide-react';
import { schSchedules } from '@/lib/scheduleApi.js';
import { pmProjects } from '@/lib/pmApi.js';
import { Section, EmptyState } from '@/components/pm/Shared.jsx';
import { TextField, SelectField, FieldGroup } from '@/components/ui/Field.jsx';
import ActorBar from '@/components/pm/ActorBar.jsx';

export default function SchedulesListPage() {
  const [schedules, setSchedules] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ project_id: '', name: '', version_label: '', data_date: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    const [schedRes, projRes] = await Promise.all([schSchedules.list(), pmProjects.list({ pageSize: 200 })]);
    if (schedRes.success) setSchedules(schedRes.schedules);
    if (projRes.success) setProjects(projRes.rows || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createSchedule() {
    if (!form.project_id) { setError('اختر المشروع أولاً.'); return; }
    setSaving(true);
    setError('');
    const res = await schSchedules.create({ ...form, project_id: Number(form.project_id) });
    setSaving(false);
    if (!res.success) { setError(res.error); return; }
    setShowForm(false);
    setForm({ project_id: '', name: '', version_label: '', data_date: '' });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-lg font-bold text-navy-800 flex items-center gap-2"><CalendarRange size={20} className="text-rebar-600" /> الجداول الزمنية</h1>
        <div className="flex items-center gap-2">
          <ActorBar />
          <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-1.5 rounded-md bg-navy-600 hover:bg-navy-700 text-white text-sm font-medium px-3 py-2 transition-colors">
            <Plus size={15} /> جدول جديد
          </button>
        </div>
      </div>

      {showForm && (
        <Section title="إنشاء جدول زمني جديد">
          <div className="space-y-3">
            <SelectField
              label="المشروع"
              value={form.project_id}
              onChange={(v) => setForm((f) => ({ ...f, project_id: v }))}
              options={[{ value: '', label: '— اختر مشروعاً —' }, ...projects.map((p) => ({ value: String(p.id), label: p.name }))]}
            />
            <FieldGroup cols={2}>
              <TextField label="اسم الجدول" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="الجدول الزمني الرئيسي" />
              <TextField label="تسمية الإصدار (اختياري)" value={form.version_label} onChange={(v) => setForm((f) => ({ ...f, version_label: v }))} placeholder="مثال: إصدار العقد" />
            </FieldGroup>
            {error && <p className="text-xs text-fail-700">{error}</p>}
            <div className="flex gap-2">
              <button disabled={saving} onClick={createSchedule} className="rounded-md bg-navy-600 hover:bg-navy-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 transition-colors">
                {saving ? 'جارِ الإنشاء…' : 'إنشاء الجدول'}
              </button>
              <button onClick={() => setShowForm(false)} className="rounded-md border border-line text-sm px-4 py-2 text-ink hover:bg-paper transition-colors">إلغاء</button>
            </div>
          </div>
        </Section>
      )}

      {loading && <div className="text-sm text-ink-soft">جارِ التحميل…</div>}

      {!loading && schedules.length === 0 && (
        <EmptyState icon={CalendarRange} title="لا توجد جداول زمنية بعد" message="أنشئ أول جدول زمني لبدء التخطيط." />
      )}

      {!loading && schedules.length > 0 && (
        <div className="grid md:grid-cols-2 gap-3">
          {schedules.map((s) => (
            <Link
              key={s.id}
              href={`/dashboard/schedule/schedules/${s.id}`}
              className="rounded-sheet border border-line bg-white p-4 hover:border-navy-300 hover:shadow-sheet transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {!!s.is_primary && <Star size={13} className="text-rebar-500 fill-rebar-500 shrink-0" />}
                    <h3 className="font-bold text-ink truncate">{s.name}</h3>
                  </div>
                  <p className="text-xs text-ink-soft mt-0.5 truncate">{s.project_name} · {s.project_code}</p>
                </div>
                <ArrowLeft size={16} className="text-concrete-300 group-hover:text-navy-500 shrink-0 transition-colors" />
              </div>
              <div className="flex items-center gap-3 mt-3 text-[11px] text-ink-soft">
                {s.status === 'archived' && <span className="flex items-center gap-1"><Archive size={11} /> مؤرشف</span>}
                {s.version_label && <span className="font-mono">{s.version_label}</span>}
                {s.data_date && <span className="font-mono" dir="ltr">تاريخ البيانات: {s.data_date}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
