'use client';
import { useEffect, useState, useCallback } from 'react';
import { Save } from 'lucide-react';
import { schSchedules, schActivities } from '@/lib/scheduleApi.js';
import { TaskStatusBadge } from '@/components/pm/StatusBadge.jsx';
import { Section, EmptyState } from '@/components/pm/Shared.jsx';
import { SelectField, NumberField, FieldGroup, TextField } from '@/components/ui/Field.jsx';
import { DateField } from '@/components/pm/PmField.jsx';

export default function ProgressTab({ schedule, activities, onChanged }) {
  const [comparison, setComparison] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activityId, setActivityId] = useState('');
  const [form, setForm] = useState({ progress_pct: 0, actual_start: '', actual_end: '', delay_reason: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await schSchedules.variance(schedule.id);
    if (res.success) setComparison(res.comparison);
    setLoading(false);
  }, [schedule.id]);

  useEffect(() => { load(); }, [load]);

  async function logProgress() {
    if (!activityId) return;
    setSaving(true);
    await schActivities.logProgress(Number(activityId), form);
    setSaving(false);
    setForm({ progress_pct: 0, actual_start: '', actual_end: '', delay_reason: '' });
    load();
    onChanged();
  }

  const realActivities = activities.filter((a) => a.activity_type !== 'summary');

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-1">
        <Section title="تحديث تقدّم نشاط">
          <div className="space-y-3">
            <SelectField label="النشاط" value={activityId} onChange={setActivityId} options={[{ value: '', label: '— اختر نشاطاً —' }, ...realActivities.map((a) => ({ value: String(a.id), label: `${a.wbs_code} ${a.name}` }))]} />
            <NumberField label="نسبة الإنجاز الفعلية" unit="%" value={form.progress_pct} onChange={(v) => setForm((f) => ({ ...f, progress_pct: v }))} min={0} />
            <FieldGroup cols={2}>
              <DateField label="بداية فعلية" value={form.actual_start} onChange={(v) => setForm((f) => ({ ...f, actual_start: v }))} />
              <DateField label="نهاية فعلية" value={form.actual_end} onChange={(v) => setForm((f) => ({ ...f, actual_end: v }))} />
            </FieldGroup>
            <TextField label="سبب التأخير (إن وُجد)" value={form.delay_reason} onChange={(v) => setForm((f) => ({ ...f, delay_reason: v }))} placeholder="مثال: تأخر توريد مواد" />
            <button onClick={logProgress} disabled={!activityId || saving} className="flex items-center gap-1.5 rounded-md bg-navy-600 hover:bg-navy-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 w-full justify-center transition-colors">
              <Save size={14} /> {saving ? 'جارِ الحفظ…' : 'تسجيل التحديث'}
            </button>
          </div>
        </Section>
      </div>

      <div className="lg:col-span-2">
        <Section title="مقارنة المخطط بالفعلي">
          {loading && <p className="text-xs text-ink-soft">جارِ التحميل…</p>}
          {!loading && comparison.length === 0 && <EmptyState title="لا أنشطة بعد" />}
          {!loading && comparison.length > 0 && (
            <div className="overflow-x-auto -mx-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-ink-soft border-b border-line">
                    <th className="text-right font-medium px-4 py-1.5">النشاط</th>
                    <th className="text-right font-medium px-2 py-1.5">الحالة</th>
                    <th className="text-right font-medium px-2 py-1.5">المخطط</th>
                    <th className="text-right font-medium px-2 py-1.5">الفعلي</th>
                    <th className="text-right font-medium px-2 py-1.5">الفرق</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((c) => (
                    <tr key={c.id} className="border-b border-line/60">
                      <td className="px-4 py-1.5 truncate max-w-[160px]">{c.wbs_code} {c.name}</td>
                      <td className="px-2 py-1.5"><TaskStatusBadge status={c.status} /></td>
                      <td className="px-2 py-1.5 font-mono" dir="ltr">{c.planned_end || '—'}</td>
                      <td className="px-2 py-1.5 font-mono" dir="ltr">{c.actual_end || '—'}</td>
                      <td className={`px-2 py-1.5 font-mono ${c.is_delayed ? 'text-fail-700' : c.is_ahead ? 'text-pass-700' : 'text-ink-soft'}`} dir="ltr">
                        {c.variance_days == null ? '—' : c.variance_days > 0 ? `+${c.variance_days}` : c.variance_days}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
