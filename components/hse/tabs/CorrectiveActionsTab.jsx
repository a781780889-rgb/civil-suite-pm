'use client';
import { useEffect, useState } from 'react';
import { ClipboardX } from 'lucide-react';
import { Section, EmptyState } from '@/components/pm/Shared.jsx';
import { NumberField, TextField } from '@/components/ui/Field.jsx';
import { StatusBadge } from '@/components/hse/StatusBadge.jsx';
import { CORRECTIVE_ACTION_STATUS_OPTIONS, optionLabel } from '@/lib/hseConstants.js';
import * as hseApi from '@/lib/hseApi.js';

const SOURCE_LABELS = { inspection_item: 'بند تفتيش', incident: 'حادث', near_miss: 'بلاغ قريب من حادث', violation: 'مخالفة', risk: 'خطر' };

export default function CorrectiveActionsTab({ projectId }) {
  const [rows, setRows] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [closing, setClosing] = useState(null);
  const [approvedBy, setApprovedBy] = useState('');
  const [error, setError] = useState(null);

  async function load() {
    const res = await hseApi.listCorrectiveActions({ project_id: projectId, status: statusFilter || undefined, pageSize: 100 });
    setRows(res.rows);
  }
  useEffect(() => { load(); }, [projectId, statusFilter]);

  async function updateProgress(id, completion_pct) {
    await hseApi.updateCorrectiveActionProgress(id, { completion_pct, status: completion_pct >= 100 ? 'completed' : 'in_progress' });
    load();
  }

  async function handleClose(id) {
    setError(null);
    try { await hseApi.approveAndCloseCorrectiveAction(id, { approved_by: approvedBy }); setClosing(null); setApprovedBy(''); load(); }
    catch (err) { setError(err.message); }
  }

  return (
    <Section title="الإجراءات التصحيحية" action={
      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-sheet border border-line px-2 py-1.5 text-sm">
        <option value="">كل الحالات</option>
        {CORRECTIVE_ACTION_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    }>
      {error && <p className="mb-3 rounded-sheet bg-fail-50 p-2 text-sm text-fail-700">{error}</p>}
      {rows.length === 0 ? <EmptyState icon={ClipboardX} title="لا إجراءات" message="تظهر هنا الإجراءات التصحيحية المُنشأة تلقائياً من نتائج التفتيش والحوادث والمخالفات." /> : (
        <div className="space-y-2">
          {rows.map((a) => (
            <div key={a.id} className="rounded-sheet border border-line bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-ink">{a.action_no} — {a.description}</p>
                  <p className="text-xs text-ink-soft">المصدر: {SOURCE_LABELS[a.source_type] || a.source_type} #{a.source_id} {a.due_date ? `· مستحق: ${a.due_date}` : ''} {a.responsible ? `· ${a.responsible}` : ''}</p>
                </div>
                <StatusBadge status={a.status} small />
              </div>
              {a.status !== 'closed' && (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-ink-soft">نسبة الإنجاز:</span>
                    <input type="range" min="0" max="100" step="10" value={a.completion_pct} onChange={(e) => updateProgress(a.id, Number(e.target.value))} className="w-32" />
                    <span className="text-xs font-medium text-ink">{a.completion_pct}%</span>
                  </div>
                  {a.completion_pct >= 100 && closing !== a.id && (
                    <button onClick={() => setClosing(a.id)} className="text-xs text-pass-700 hover:underline">اعتماد الإغلاق</button>
                  )}
                  {closing === a.id && (
                    <div className="flex items-center gap-2">
                      <input placeholder="اسم المعتمِد" value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} className="rounded-sheet border border-line px-2 py-1 text-xs" />
                      <button onClick={() => handleClose(a.id)} className="rounded-sheet bg-navy-700 px-2 py-1 text-xs font-medium text-white">تأكيد</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
