'use client';
import { useEffect, useState } from 'react';
import { Section, EmptyState } from '@/components/pm/Shared.jsx';
import { listAuditLog } from '@/lib/equipmentApi.js';

const ACTION_LABELS = {
  create: 'إنشاء', update: 'تعديل', delete: 'حذف', archive: 'أرشفة', hard_delete: 'حذف نهائي',
  status_change: 'تغيير حالة', resolve: 'إصلاح عطل', complete: 'إنهاء', use: 'استخدام قطعة غيار',
};

export default function AuditTab({ equipment }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAuditLog({ equipment_id: equipment.id, pageSize: 100 }).then((res) => setRows(res.rows || [])).finally(() => setLoading(false));
  }, [equipment.id]);

  return (
    <Section title="سجل التدقيق (Audit Log)">
      {loading && <p className="text-sm text-ink-soft">جارِ التحميل...</p>}
      {!loading && rows.length === 0 && <EmptyState title="لا توجد عمليات مسجّلة بعد" />}
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between text-xs py-1.5 border-b border-line last:border-0">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-line text-ink-soft">{ACTION_LABELS[r.action] || r.action}</span>
              <span className="text-ink-soft">{r.entity_type}</span>
              {r.actor && <span className="text-ink-soft">— {r.actor}</span>}
            </div>
            <span className="text-ink-soft font-mono">{r.created_at}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}
