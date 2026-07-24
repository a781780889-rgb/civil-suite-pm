'use client';
// components/pm/tabs/OverviewTab.jsx

import { useState } from 'react';
import { ListChecks, Wallet, ShieldAlert, ShieldCheck, Users, FileText, AlertTriangle, Link2 } from 'lucide-react';
import { StatCard, Section } from '@/components/pm/Shared.jsx';
import { pmProjects, PROJECT_STATUS_LABELS } from '@/lib/pmApi.js';

export default function OverviewTab({ stats, onChanged }) {
  const { project, progressPct, phasesCount, tasksTotal, tasksByStatus, delayedTasksCount, teamCount, activeTeamCount,
    budgetSummary, openRisksCount, highRisksCount, openQualityCount, openSafetyCount, documentsCount,
    pendingApprovalDocumentsCount, statusHistory, integration } = stats;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={ListChecks} label="نسبة الإنجاز" value={`${progressPct}%`} />
        <StatCard icon={ListChecks} label="المهام" value={`${tasksTotal} (${phasesCount} مرحلة)`} small />
        <StatCard icon={AlertTriangle} label="مهام متأخرة" value={delayedTasksCount} tone={delayedTasksCount > 0 ? 'fail' : 'navy'} />
        <StatCard icon={Users} label="أعضاء الفريق" value={`${activeTeamCount}/${teamCount}`} small />
        <StatCard icon={Wallet} label="نسبة الصرف" value={`${budgetSummary.spentPct}%`} tone={budgetSummary.isOverBudget ? 'fail' : 'navy'} />
        <StatCard icon={ShieldAlert} label="مخاطر مفتوحة" value={`${openRisksCount} (${highRisksCount} عالية)`} small tone={highRisksCount > 0 ? 'fail' : 'navy'} />
        <StatCard icon={ShieldCheck} label="جودة/سلامة مفتوحة" value={`${openQualityCount}/${openSafetyCount}`} small />
        <StatCard icon={FileText} label="المستندات" value={`${documentsCount} (${pendingApprovalDocumentsCount} بانتظار الاعتماد)`} small />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Section title="بيانات المشروع">
          <dl className="text-sm space-y-2">
            <Row label="الوصف" value={project.description} />
            <Row label="المالك" value={project.owner_name} />
            <Row label="العميل" value={project.client_name} />
            <Row label="المقاول الرئيسي" value={project.contractor_name} />
            <Row label="المقاول الفرعي" value={project.subcontractor_name} />
            <Row label="المكتب الاستشاري" value={project.consultant_name} />
            <Row label="مدير المشروع" value={project.project_manager_name} />
            <Row label="المهندس المسؤول" value={project.engineer_name} />
            <Row label="الموقع" value={[project.location, project.city, project.country].filter(Boolean).join('، ')} />
            <Row label="قيمة العقد" value={project.contract_value ? `${Number(project.contract_value).toLocaleString('en-US')} ${project.currency}` : null} mono />
          </dl>
        </Section>

        <div className="space-y-4">
          <Section title="تغيير حالة المشروع">
            <StatusChanger project={project} onChanged={onChanged} />
          </Section>
          <Section title="سجل تغييرات الحالة">
            {statusHistory.length === 0 && <p className="text-xs text-ink-soft">لا يوجد سجل بعد.</p>}
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {statusHistory.map((h) => (
                <div key={h.id} className="text-xs flex items-center justify-between gap-2 border-b border-line/60 pb-1.5 last:border-0">
                  <span className="text-ink">{h.old_status ? `${PROJECT_STATUS_LABELS[h.old_status] || h.old_status} ← ` : ''}{PROJECT_STATUS_LABELS[h.new_status] || h.new_status}</span>
                  <span className="text-ink-soft font-mono tabular-figure shrink-0" dir="ltr">{formatDate(h.created_at)}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>

      <Section title="التكامل مع الأقسام الأخرى" action={<Link2 size={14} className="text-ink-soft" />}>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-md bg-paper p-3">
            <p className="text-ink-soft text-xs">حسابات مرتبطة (خرسانة/حديد)</p>
            <p className="font-bold text-navy-700 font-mono tabular-figure text-lg">{integration.linkedCalculations}</p>
          </div>
          <div className="rounded-md bg-paper p-3">
            <p className="text-ink-soft text-xs">عناصر حصر كميات (BOQ)</p>
            <p className="font-bold text-navy-700 font-mono tabular-figure text-lg">{integration.boqElementsCount}</p>
            {integration.boqElementsCost > 0 && <p className="text-xs text-ink-soft mt-0.5">التكلفة: {integration.boqElementsCost.toLocaleString('en-US')} {project.currency}</p>}
          </div>
        </div>
      </Section>
    </div>
  );
}

function StatusChanger({ project, onChanged }) {
  const [status, setStatus] = useState(project.status);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function apply() {
    if (status === project.status) return;
    setSaving(true); setError('');
    const res = await pmProjects.changeStatus(project.id, status, note);
    setSaving(false);
    if (res.success) { setNote(''); onChanged(); }
    else setError(res.error || 'تعذّر تغيير الحالة.');
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-fail-700">{error}</p>}
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-md border border-line px-3 py-2 text-sm">
        {Object.entries(PROJECT_STATUS_LABELS).filter(([k]) => k !== 'archived').map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة (اختياري)" className="w-full rounded-md border border-line px-3 py-2 text-sm" />
      <button onClick={apply} disabled={saving || status === project.status} className="w-full rounded-md bg-navy-600 text-white text-sm py-2 disabled:opacity-50">
        {saving ? 'جارِ الحفظ…' : 'تطبيق تغيير الحالة'}
      </button>
    </div>
  );
}

function Row({ label, value, mono }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-ink-soft shrink-0">{label}</dt>
      <dd className={`text-ink text-left ${mono ? 'font-mono tabular-figure' : ''}`}>{value}</dd>
    </div>
  );
}

function formatDate(s) {
  if (!s) return '';
  try { return new Date(s + 'Z').toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' }); } catch { return s; }
}
