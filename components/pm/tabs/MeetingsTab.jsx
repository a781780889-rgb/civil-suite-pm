'use client';
// components/pm/tabs/MeetingsTab.jsx

import { useEffect, useState } from 'react';
import { Plus, Trash2, Sparkles, ListPlus } from 'lucide-react';
import { pmMeetings, pmAi } from '@/lib/pmApi.js';
import { TextField, ToggleField } from '@/components/ui/Field.jsx';
import { DateField, TextAreaField } from '@/components/pm/PmField.jsx';
import { Section, EmptyState, ConfirmDialog } from '@/components/pm/Shared.jsx';

export default function MeetingsTab({ projectId }) {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [expanded, setExpanded] = useState(null);

  async function load() {
    setLoading(true);
    const res = await pmMeetings.list(projectId);
    setLoading(false);
    if (res.success) setMeetings(res.meetings);
  }
  useEffect(() => { load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function remove() {
    await pmMeetings.remove(deleteTarget.id);
    setDeleteTarget(null);
    load();
  }

  return (
    <Section title={`الاجتماعات (${meetings.length})`} action={
      <button onClick={() => setEditing({ project_id: projectId, attendees: [] })} className="flex items-center gap-1.5 text-xs font-medium text-navy-700 hover:underline">
        <Plus size={13} /> اجتماع جديد
      </button>
    }>
      {loading && <p className="text-sm text-ink-soft">جارِ التحميل…</p>}
      {!loading && meetings.length === 0 && <EmptyState title="لا توجد اجتماعات مسجّلة بعد" />}

      <div className="space-y-2">
        {meetings.map((m) => (
          <div key={m.id} className="rounded-md border border-line p-3">
            <div className="flex items-center justify-between gap-3 flex-wrap cursor-pointer" onClick={() => setExpanded(expanded === m.id ? null : m.id)}>
              <div>
                <span className="font-medium text-ink text-sm">{m.title}</span>
                <span className="text-[11px] text-ink-soft mr-2 font-mono tabular-figure" dir="ltr">{m.meeting_date}</span>
              </div>
              <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(m); }}><Trash2 size={13} className="text-ink-soft hover:text-fail-DEFAULT" /></button>
            </div>
            {expanded === m.id && <MeetingDetail meeting={m} projectId={projectId} />}
          </div>
        ))}
      </div>

      {editing && <MeetingFormModal meeting={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      <ConfirmDialog open={!!deleteTarget} title="حذف الاجتماع؟" onConfirm={remove} onCancel={() => setDeleteTarget(null)} />
    </Section>
  );
}

function MeetingDetail({ meeting, projectId }) {
  const [decisions, setDecisions] = useState([]);
  const [newDecision, setNewDecision] = useState('');
  const [responsible, setResponsible] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [generateTask, setGenerateTask] = useState(true);
  const [summary, setSummary] = useState(null);
  const [summarizing, setSummarizing] = useState(false);

  async function load() {
    const res = await pmMeetings.decisions(meeting.id);
    if (res.success) setDecisions(res.decisions);
  }
  useEffect(() => { load(); }, [meeting.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function addDecision() {
    if (!newDecision.trim()) return;
    await pmMeetings.addDecision(meeting.id, { decision_text: newDecision, responsible, due_date: dueDate, generateTask, project_id: projectId });
    setNewDecision(''); setResponsible(''); setDueDate('');
    load();
  }

  async function summarize() {
    setSummarizing(true);
    const res = await pmAi.meetingSummary(meeting.id);
    setSummarizing(false);
    if (res.success) setSummary(res.summary);
  }

  return (
    <div className="mt-3 pt-3 border-t border-line space-y-3">
      {meeting.agenda && <p className="text-xs text-ink-soft"><span className="font-medium text-ink">جدول الأعمال:</span> {meeting.agenda}</p>}
      {meeting.minutes && <p className="text-xs text-ink-soft"><span className="font-medium text-ink">محضر الاجتماع:</span> {meeting.minutes}</p>}

      <button onClick={summarize} disabled={summarizing} className="flex items-center gap-1.5 text-xs text-navy-600 hover:underline disabled:opacity-60">
        <Sparkles size={12} /> {summarizing ? 'جارِ التلخيص…' : 'تلخيص بالذكاء الاصطناعي'}
      </button>
      {summary && (
        <div className="rounded-md bg-navy-50 p-2.5 text-xs text-ink space-y-1">
          <p>{summary.summary}</p>
          {summary.openDecisions?.length > 0 && <p className="text-ink-soft">قرارات مفتوحة: {summary.openDecisions.join('، ')}</p>}
        </div>
      )}

      <div>
        <p className="text-xs font-bold text-navy-700 mb-1.5">القرارات</p>
        <div className="space-y-1">
          {decisions.map((d) => (
            <div key={d.id} className="text-xs bg-paper rounded px-2 py-1.5 flex items-center justify-between">
              <span>{d.decision_text} {d.responsible && `— ${d.responsible}`}</span>
              {d.generated_task_id && <span className="flex items-center gap-1 text-navy-600 text-[10px]"><ListPlus size={10} /> مهمة #{d.generated_task_id}</span>}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <input value={newDecision} onChange={(e) => setNewDecision(e.target.value)} placeholder="قرار جديد…" className="flex-1 min-w-[140px] rounded border border-line px-2 py-1.5 text-xs" />
          <input value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder="المسؤول" className="w-24 rounded border border-line px-2 py-1.5 text-xs" />
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="rounded border border-line px-2 py-1.5 text-xs font-mono" dir="ltr" />
          <label className="flex items-center gap-1 text-[11px] text-ink-soft"><input type="checkbox" checked={generateTask} onChange={(e) => setGenerateTask(e.target.checked)} /> إنشاء مهمة</label>
          <button onClick={addDecision} className="rounded bg-navy-600 text-white px-2.5 text-xs">إضافة</button>
        </div>
      </div>
    </div>
  );
}

function MeetingFormModal({ meeting, onClose, onSaved }) {
  const [form, setForm] = useState({ title: '', meeting_date: '', location: '', agenda: '', minutes: '', attendeesText: '', ...meeting });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    if (!form.title?.trim()) { setError('عنوان الاجتماع مطلوب.'); return; }
    setSaving(true); setError('');
    const payload = { ...form, attendees: form.attendeesText ? form.attendeesText.split('،').map((s) => s.trim()).filter(Boolean) : [] };
    const res = await pmMeetings.create(payload);
    setSaving(false);
    if (res.success) onSaved();
    else setError(res.error || 'تعذّر الحفظ.');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-sheet border border-line bg-white shadow-sheet p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-navy-700 mb-4">اجتماع جديد</h3>
        {error && <p className="text-xs text-fail-700 mb-2">{error}</p>}
        <div className="space-y-3">
          <TextField label="العنوان" value={form.title} onChange={(v) => set('title', v)} required />
          <div className="grid grid-cols-2 gap-3">
            <DateField label="التاريخ" value={form.meeting_date} onChange={(v) => set('meeting_date', v)} />
            <TextField label="المكان" value={form.location} onChange={(v) => set('location', v)} />
          </div>
          <TextField label="الحضور (مفصولون بـ ،)" value={form.attendeesText} onChange={(v) => set('attendeesText', v)} />
          <TextAreaField label="جدول الأعمال" value={form.agenda} onChange={(v) => set('agenda', v)} rows={2} />
          <TextAreaField label="محضر الاجتماع" value={form.minutes} onChange={(v) => set('minutes', v)} rows={3} />
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-md border border-line text-sm">إلغاء</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-md bg-navy-700 text-white text-sm disabled:opacity-60">{saving ? 'جارِ الحفظ…' : 'حفظ'}</button>
        </div>
      </div>
    </div>
  );
}
