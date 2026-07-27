'use client';
import { useEffect, useState, use as usePromise } from 'react';
import Link from 'next/link';
import { ArrowRight, Edit2, Plus, CheckSquare } from 'lucide-react';
import { EmptyState } from '@/components/pm/Shared.jsx';
import MeetingFormModal from '@/components/business/MeetingFormModal.jsx';
import { getMeeting, addMeetingDecision, updateDecisionStatus } from '@/lib/businessApi.js';

export default function MeetingDetailPage({ params }) {
  const { id } = usePromise(params);
  const [meeting, setMeeting] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [decisionText, setDecisionText] = useState('');
  const [responsible, setResponsible] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [createTask, setCreateTask] = useState(false);

  async function load() { setMeeting((await getMeeting(id)).meeting); }
  useEffect(() => { load(); }, [id]);

  async function addDecision(e) {
    e.preventDefault();
    await addMeetingDecision(id, { decision_text: decisionText, responsible, due_date: dueDate, create_task: createTask });
    setDecisionText(''); setResponsible(''); setDueDate(''); setCreateTask(false); setAdding(false);
    load();
  }

  if (!meeting) return <div className="p-6 text-sm text-ink-soft">جارٍ التحميل...</div>;

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <Link href="/dashboard/business/meetings" className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink"><ArrowRight size={14} /> الاجتماعات</Link>

      <div className="bg-white border border-line rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-ink">{meeting.title}</h1>
            <div className="text-sm text-ink-soft mt-1">{meeting.client_name || '—'}{meeting.location ? ` · ${meeting.location}` : ''}{meeting.meeting_date ? ` · ${meeting.meeting_date}` : ''}</div>
            {meeting.project_id && <div className="text-xs text-navy mt-1">مرتبط بمشروع تنفيذي #{meeting.project_id} — القرارات هنا يمكن أن تُنشئ مهام حقيقية في الجدول الزمني.</div>}
          </div>
          <button onClick={() => setEditOpen(true)} className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-md border border-line hover:bg-line/50"><Edit2 size={14} /> تعديل</button>
        </div>
        {meeting.agenda && <div className="mt-3"><div className="text-xs font-bold text-ink-soft mb-0.5">جدول الأعمال</div><p className="text-sm text-ink whitespace-pre-wrap">{meeting.agenda}</p></div>}
        {meeting.minutes && <div className="mt-3"><div className="text-xs font-bold text-ink-soft mb-0.5">محضر الاجتماع</div><p className="text-sm text-ink whitespace-pre-wrap">{meeting.minutes}</p></div>}
      </div>

      <div className="bg-white border border-line rounded-lg">
        <div className="px-4 py-3 border-b border-line flex items-center justify-between">
          <h3 className="font-bold text-sm text-ink">القرارات والمهام الناتجة</h3>
          <button onClick={() => setAdding((a) => !a)} className="flex items-center gap-1 text-xs font-medium text-navy hover:underline"><Plus size={13} /> قرار جديد</button>
        </div>
        {adding && (
          <form onSubmit={addDecision} className="p-4 space-y-2 border-b border-line bg-line/20">
            <textarea value={decisionText} onChange={(e) => setDecisionText(e.target.value)} required placeholder="نص القرار..." className="w-full rounded-md border border-line px-2 py-1.5 text-sm" rows={2} />
            <div className="flex flex-wrap gap-2">
              <input value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder="المسؤول" className="flex-1 min-w-[120px] rounded-md border border-line px-2 py-1.5 text-sm" />
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="flex-1 min-w-[120px] rounded-md border border-line px-2 py-1.5 text-sm" dir="ltr" />
            </div>
            {meeting.project_id && (
              <label className="flex items-center gap-2 text-xs text-ink-soft">
                <input type="checkbox" checked={createTask} onChange={(e) => setCreateTask(e.target.checked)} /> إنشاء مهمة فعلية في الجدول الزمني للمشروع المرتبط
              </label>
            )}
            <button type="submit" className="text-sm font-medium px-3 py-1.5 rounded-md bg-navy text-white">حفظ القرار</button>
          </form>
        )}
        {meeting.decisions.length === 0 ? (
          <EmptyState title="لا توجد قرارات مسجّلة" message="" />
        ) : (
          <div className="divide-y divide-line">
            {meeting.decisions.map((d) => (
              <div key={d.id} className="px-4 py-3 flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm text-ink flex items-center gap-1.5">{d.generated_task_id && <CheckSquare size={13} className="text-pass" />} {d.decision_text}</div>
                  <div className="text-xs text-ink-soft mt-0.5">{d.responsible || '—'}{d.due_date ? ` · حتى ${d.due_date}` : ''}{d.generated_task_id ? ' · مرتبط بمهمة في الجدول الزمني' : ''}</div>
                </div>
                <select value={d.status} onChange={async (e) => { await updateDecisionStatus(id, d.id, e.target.value); load(); }} className="text-xs rounded-md border border-line px-2 py-1">
                  <option value="open">مفتوح</option><option value="done">مُنجز</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      <MeetingFormModal open={editOpen} onClose={() => setEditOpen(false)} meeting={meeting} onSaved={() => { setEditOpen(false); load(); }} />
    </div>
  );
}
