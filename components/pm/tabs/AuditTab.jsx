'use client';
// components/pm/tabs/AuditTab.jsx

import { useEffect, useState } from 'react';
import { pmAudit } from '@/lib/pmApi.js';
import { Section, EmptyState } from '@/components/pm/Shared.jsx';

const ACTION_LABELS = { create: 'إنشاء', update: 'تعديل', delete: 'حذف', status_change: 'تغيير حالة', approve: 'اعتماد', reject: 'رفض', archive: 'أرشفة', unarchive: 'إلغاء أرشفة', new_version: 'إصدار جديد', hard_delete: 'حذف نهائي' };
const ENTITY_LABELS = {
  project: 'مشروع', project_status: 'حالة مشروع', phase: 'مرحلة', task: 'مهمة', task_dependency: 'تبعية مهمة',
  team_member: 'عضو فريق', budget_item: 'بند مالي', resource_assignment: 'تعيين مورد', risk: 'خطر',
  quality_record: 'سجل جودة', safety_record: 'سجل سلامة', document: 'مستند', meeting: 'اجتماع', meeting_decision: 'قرار اجتماع',
};

export default function AuditTab({ projectId }) {
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    pmAudit.list({ project_id: projectId, limit: 300 }).then((res) => {
      setLoading(false);
      if (res.success) setLog(res.log);
    });
  }, [projectId]);

  return (
    <Section title={`سجل التدقيق (${log.length})`}>
      {loading && <p className="text-sm text-ink-soft">جارِ التحميل…</p>}
      {!loading && log.length === 0 && <EmptyState title="لا يوجد سجل تدقيق بعد" />}
      <div className="divide-y divide-line max-h-[32rem] overflow-y-auto">
        {log.map((entry) => (
          <div key={entry.id} className="py-2 text-xs flex items-center justify-between gap-3">
            <span className="text-ink">
              <span className="font-medium text-navy-700">{ACTION_LABELS[entry.action] || entry.action}</span>
              {' — '}{ENTITY_LABELS[entry.entity_type] || entry.entity_type} #{entry.entity_id}
              {entry.actor && <span className="text-ink-soft"> بواسطة {entry.actor}</span>}
            </span>
            <span className="text-ink-soft font-mono tabular-figure shrink-0" dir="ltr">{formatDate(entry.created_at)}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function formatDate(s) {
  if (!s) return '';
  try { return new Date(s + 'Z').toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' }); } catch { return s; }
}
