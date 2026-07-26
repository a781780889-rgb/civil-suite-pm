'use client';
import { useEffect, useState } from 'react';
import { schSchedules } from '@/lib/scheduleApi.js';
import { Section, EmptyState } from '@/components/pm/Shared.jsx';

const ACTION_LABELS = {
  create: 'إنشاء', update: 'تعديل', delete: 'حذف', hard_delete: 'حذف نهائي',
  reorder_activities: 'إعادة ترتيب', progress_update: 'تحديث تقدّم', set_primary: 'تعيين كرئيسي',
};
const ENTITY_LABELS = {
  schedule: 'الجدول الزمني', sch_activity: 'نشاط', sch_relationship: 'علاقة', sch_baseline: 'خط أساس', sch_activity_resource: 'تعيين مورد',
};

export default function AuditTab({ schedule }) {
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    const res = await schSchedules.audit(schedule.id);
    if (res.success) setLog(res.log);
    setLoading(false);
  })(); }, [schedule.id]);

  return (
    <Section title="سجل التدقيق الكامل">
      {loading && <p className="text-xs text-ink-soft">جارِ التحميل…</p>}
      {!loading && log.length === 0 && <EmptyState title="لا سجلّات بعد" />}
      {!loading && log.length > 0 && (
        <div className="divide-y divide-line -mx-4">
          {log.map((entry) => (
            <div key={entry.id} className="px-4 py-2.5 text-sm flex items-center justify-between">
              <span>
                <span className="font-bold text-ink">{ACTION_LABELS[entry.action] || entry.action}</span>
                <span className="text-ink-soft"> — {ENTITY_LABELS[entry.entity_type] || entry.entity_type}</span>
              </span>
              <span className="text-[11px] text-ink-soft font-mono" dir="ltr">{entry.actor || '—'} · {entry.created_at}</span>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
