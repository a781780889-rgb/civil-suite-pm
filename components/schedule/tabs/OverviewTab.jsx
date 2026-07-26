'use client';
// components/schedule/tabs/OverviewTab.jsx
import { useMemo, useState } from 'react';
import { Star, Lock, Unlock, Archive, Trash2, Save } from 'lucide-react';
import { schSchedules } from '@/lib/scheduleApi.js';
import { getActor } from '@/lib/pmApi.js';
import { StatCard, Section, ConfirmDialog } from '@/components/pm/Shared.jsx';
import { DateField, TextAreaField } from '@/components/pm/PmField.jsx';

export default function OverviewTab({ schedule, activities, onChanged }) {
  const [dataDate, setDataDate] = useState(schedule.data_date || '');
  const [notes, setNotes] = useState(schedule.notes || '');
  const [saving, setSaving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmHardDelete, setConfirmHardDelete] = useState(false);
  const { actor_role } = getActor();

  const real = activities.filter((a) => a.activity_type !== 'summary');
  const stats = useMemo(() => {
    const completed = real.filter((a) => a.status === 'completed').length;
    const critical = real.filter((a) => a.is_critical).length;
    const weight = real.reduce((s, a) => s + Math.max(0.01, a.duration_days || 1), 0);
    const progress = weight ? Math.round((real.reduce((s, a) => s + (Number(a.progress_pct) || 0) * Math.max(0.01, a.duration_days || 1), 0) / weight) * 10) / 10 : 0;
    return { total: real.length, completed, critical, progress };
  }, [real]);

  async function save() {
    setSaving(true);
    await schSchedules.update(schedule.id, { data_date: dataDate || null, notes });
    setSaving(false);
    onChanged();
  }

  async function toggleLock() {
    await schSchedules.update(schedule.id, { is_locked: !schedule.is_locked });
    onChanged();
  }

  async function makePrimary() {
    await schSchedules.setPrimary(schedule.id);
    onChanged();
  }

  async function archive() {
    await schSchedules.archive(schedule.id);
    setConfirmArchive(false);
    onChanged();
  }

  async function hardDelete() {
    await schSchedules.hardDelete(schedule.id);
    setConfirmHardDelete(false);
    window.location.href = '/dashboard/schedule/schedules';
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="إجمالي الأنشطة" value={stats.total} />
        <StatCard label="أنشطة منجزة" value={stats.completed} tone="pass" />
        <StatCard label="أنشطة حرجة" value={stats.critical} tone={stats.critical ? 'warn' : 'navy'} />
        <StatCard label="نسبة الإنجاز" value={`${stats.progress}%`} tone="pass" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Section title="بيانات الجدول">
          <div className="space-y-3">
            <DateField label="تاريخ البيانات (Data Date)" value={dataDate} onChange={setDataDate} help="أساس حساب الأنشطة المتأخرة/القادمة والمسار الحرج." />
            <TextAreaField label="ملاحظات" value={notes} onChange={setNotes} rows={3} />
            <button onClick={save} disabled={saving} className="flex items-center gap-1.5 rounded-md bg-navy-600 hover:bg-navy-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 transition-colors">
              <Save size={14} /> {saving ? 'جارِ الحفظ…' : 'حفظ'}
            </button>
          </div>
        </Section>

        <Section title="إجراءات الجدول">
          <div className="space-y-2">
            <button onClick={makePrimary} disabled={!!schedule.is_primary} className="w-full flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-ink hover:bg-paper disabled:opacity-50 transition-colors">
              <Star size={14} className={schedule.is_primary ? 'text-rebar-500 fill-rebar-500' : 'text-ink-soft'} />
              {schedule.is_primary ? 'هذا هو الجدول الرئيسي للمشروع' : 'تعيينه كجدول رئيسي للمشروع'}
            </button>
            <button onClick={toggleLock} className="w-full flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-ink hover:bg-paper transition-colors">
              {schedule.is_locked ? <Unlock size={14} className="text-warnclr-DEFAULT" /> : <Lock size={14} className="text-ink-soft" />}
              {schedule.is_locked ? 'فكّ القفل (السماح بالتعديل)' : 'قفل الجدول (منع أي تعديل)'}
            </button>
            <button onClick={() => setConfirmArchive(true)} className="w-full flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-ink hover:bg-paper transition-colors">
              <Archive size={14} className="text-ink-soft" /> أرشفة الجدول
            </button>
            {actor_role === 'system_admin' && (
              <button onClick={() => setConfirmHardDelete(true)} className="w-full flex items-center gap-2 rounded-md border border-fail-100 bg-fail-50 px-3 py-2 text-sm text-fail-700 hover:bg-fail-100 transition-colors">
                <Trash2 size={14} /> حذف نهائي (مدير النظام فقط)
              </button>
            )}
          </div>
        </Section>
      </div>

      <ConfirmDialog open={confirmArchive} title="أرشفة الجدول الزمني؟" message="يمكن استرجاعه لاحقاً من قائمة الجداول." confirmLabel="أرشفة" onConfirm={archive} onCancel={() => setConfirmArchive(false)} />
      <ConfirmDialog open={confirmHardDelete} title="حذف نهائي؟" message="لا يمكن التراجع عن هذا الإجراء - سيُحذف الجدول وكل أنشطته وعلاقاته وبياناته نهائياً." confirmLabel="حذف نهائي" onConfirm={hardDelete} onCancel={() => setConfirmHardDelete(false)} />
    </div>
  );
}
