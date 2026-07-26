'use client';
import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { schActivities, schActivityResources, schResourceConflicts } from '@/lib/scheduleApi.js';
import { pmResources } from '@/lib/pmApi.js';
import { Section, StatCard, EmptyState } from '@/components/pm/Shared.jsx';
import { SelectField, NumberField, FieldGroup } from '@/components/ui/Field.jsx';

const TYPE_LABELS = { labor: 'عمالة', equipment: 'معدات', material: 'مواد', vehicle: 'مركبات', warehouse: 'مستودع', tool: 'أدوات' };

export default function ResourcesTab({ schedule, activities }) {
  const [resourcePool, setResourcePool] = useState([]);
  const [activityId, setActivityId] = useState('');
  const [assignments, setAssignments] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [form, setForm] = useState({ resource_id: '', quantity: 1, planned_hours: 0 });
  const [loading, setLoading] = useState(false);

  const realActivities = activities.filter((a) => a.activity_type !== 'summary');

  useEffect(() => { (async () => {
    const res = await pmResources.list({ pageSize: 200 });
    if (res.success) setResourcePool(res.resources || res.rows || []);
  })(); }, []);

  async function loadAssignments(id) {
    setLoading(true);
    const res = await schActivities.resources(id);
    if (res.success) setAssignments(res.assignments);
    setLoading(false);
  }

  useEffect(() => { if (activityId) loadAssignments(Number(activityId)); }, [activityId]);

  async function assign() {
    if (!form.resource_id) return;
    const res = await schActivities.assignResource(Number(activityId), form);
    if (res.success) {
      setForm({ resource_id: '', quantity: 1, planned_hours: 0 });
      loadAssignments(Number(activityId));
      if (res.conflicts?.length) setConflicts(res.conflicts);
    }
  }

  async function remove(id) {
    await schActivityResources.remove(id);
    loadAssignments(Number(activityId));
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-1 space-y-4">
        <Section title="اختر نشاطاً">
          <SelectField
            label="النشاط"
            value={activityId}
            onChange={setActivityId}
            options={[{ value: '', label: '— اختر نشاطاً —' }, ...realActivities.map((a) => ({ value: String(a.id), label: `${a.wbs_code} ${a.name}` }))]}
          />
        </Section>
        {conflicts.length > 0 && (
          <div className="rounded-sheet border border-fail-100 bg-fail-50 p-3 text-xs text-fail-700 flex items-start gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>هذا المورد لديه {conflicts.length} تعارض جدولة مع تعيينات أخرى (تداخل تواريخ). راجع مستودع الموارد بالقسم الرابع لمزيد من التفاصيل.</span>
          </div>
        )}
      </div>

      <div className="lg:col-span-2">
        {!activityId ? (
          <EmptyState title="اختر نشاطاً لعرض/تعيين الموارد" />
        ) : (
          <Section title="الموارد المعيّنة">
            {loading && <p className="text-xs text-ink-soft">جارِ التحميل…</p>}
            {!loading && assignments.length === 0 && <p className="text-xs text-ink-soft mb-3">لا موارد معيّنة بعد لهذا النشاط.</p>}
            {!loading && assignments.length > 0 && (
              <div className="divide-y divide-line mb-3">
                {assignments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="min-w-0 truncate">
                      {a.resource_name} <span className="text-[11px] text-ink-soft">({TYPE_LABELS[a.resource_type] || a.resource_type})</span>
                    </span>
                    <span className="flex items-center gap-3 text-[11px] font-mono text-ink-soft shrink-0" dir="ltr">
                      {a.quantity} {a.unit || ''} · {a.planned_hours}h · {Number(a.planned_cost).toLocaleString()} ر.س
                      <button onClick={() => remove(a.id)} className="text-concrete-400 hover:text-fail-600"><Trash2 size={13} /></button>
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t border-line pt-3">
              <FieldGroup cols={2}>
                <SelectField
                  label="المورد"
                  value={form.resource_id}
                  onChange={(v) => setForm((f) => ({ ...f, resource_id: v }))}
                  options={[{ value: '', label: '— اختر مورداً —' }, ...resourcePool.map((r) => ({ value: String(r.id), label: `${r.name} (${TYPE_LABELS[r.resource_type] || r.resource_type})` }))]}
                />
                <NumberField label="الكمية" value={form.quantity} onChange={(v) => setForm((f) => ({ ...f, quantity: v }))} min={0} />
              </FieldGroup>
              <div className="mt-3">
                <NumberField label="ساعات العمل المخططة" unit="ساعة" value={form.planned_hours} onChange={(v) => setForm((f) => ({ ...f, planned_hours: v }))} min={0} required={false} />
              </div>
              <button onClick={assign} className="mt-3 flex items-center gap-1.5 rounded-md bg-navy-600 hover:bg-navy-700 text-white text-sm font-medium px-4 py-2 transition-colors">
                <Plus size={14} /> تعيين المورد
              </button>
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
