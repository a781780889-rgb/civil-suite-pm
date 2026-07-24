'use client';
// components/pm/tabs/TeamTab.jsx

import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, CalendarCheck } from 'lucide-react';
import { pmTeam, pmAttendance, ROLE_LABELS } from '@/lib/pmApi.js';
import { TextField, SelectField, NumberField, FieldGroup, ToggleField } from '@/components/ui/Field.jsx';
import { DateField } from '@/components/pm/PmField.jsx';
import { Section, EmptyState, ConfirmDialog } from '@/components/pm/Shared.jsx';

const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));

export default function TeamTab({ projectId }) {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [attendanceFor, setAttendanceFor] = useState(null);

  async function load() {
    setLoading(true);
    const res = await pmTeam.list(projectId);
    setLoading(false);
    if (res.success) setTeam(res.team);
  }
  useEffect(() => { load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function remove() {
    await pmTeam.remove(deleteTarget.id);
    setDeleteTarget(null);
    load();
  }

  return (
    <Section title={`الفريق (${team.length})`} action={
      <button onClick={() => setEditing({ project_id: projectId, role: 'engineer', is_active: true })} className="flex items-center gap-1.5 text-xs font-medium text-navy-700 hover:underline">
        <Plus size={13} /> عضو جديد
      </button>
    }>
      {loading && <p className="text-sm text-ink-soft">جارِ التحميل…</p>}
      {!loading && team.length === 0 && <EmptyState title="لا يوجد أعضاء بعد" message="أضف أعضاء فريق المشروع وحدد أدوارهم." />}

      <div className="grid sm:grid-cols-2 gap-2">
        {team.map((m) => (
          <div key={m.id} className={`rounded-md border border-line p-3 ${!m.is_active ? 'opacity-50' : ''}`}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-medium text-ink text-sm">{m.name}</p>
                <p className="text-[11px] text-navy-600">{ROLE_LABELS[m.role] || m.role}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setAttendanceFor(m)} title="الحضور"><CalendarCheck size={13} className="text-ink-soft hover:text-navy-600" /></button>
                <button onClick={() => setEditing(m)}><Pencil size={13} className="text-ink-soft hover:text-navy-600" /></button>
                <button onClick={() => setDeleteTarget(m)}><Trash2 size={13} className="text-ink-soft hover:text-fail-DEFAULT" /></button>
              </div>
            </div>
            {(m.phone || m.email) && <p className="text-[11px] text-ink-soft mt-1.5">{[m.phone, m.email].filter(Boolean).join(' · ')}</p>}
            {m.cost_per_day > 0 && <p className="text-[11px] text-ink-soft font-mono tabular-figure mt-0.5" dir="ltr">{m.cost_per_day}/يوم</p>}
          </div>
        ))}
      </div>

      {editing && <MemberFormModal member={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {attendanceFor && <AttendanceModal member={attendanceFor} projectId={projectId} onClose={() => setAttendanceFor(null)} />}
      <ConfirmDialog open={!!deleteTarget} title="حذف عضو الفريق؟" onConfirm={remove} onCancel={() => setDeleteTarget(null)} />
    </Section>
  );
}

function MemberFormModal({ member, onClose, onSaved }) {
  const isNew = !member.id;
  const [form, setForm] = useState({ name: '', role: 'engineer', phone: '', email: '', cost_per_day: '', is_active: true, ...member });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    if (!form.name?.trim()) { setError('الاسم مطلوب.'); return; }
    setSaving(true); setError('');
    const res = isNew ? await pmTeam.create(form) : await pmTeam.update(member.id, form);
    setSaving(false);
    if (res.success) onSaved();
    else setError(res.error || 'تعذّر الحفظ.');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-sheet border border-line bg-white shadow-sheet p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-navy-700 mb-4">{isNew ? 'عضو جديد' : 'تعديل العضو'}</h3>
        {error && <p className="text-xs text-fail-700 mb-2">{error}</p>}
        <div className="space-y-3">
          <TextField label="الاسم" value={form.name} onChange={(v) => set('name', v)} required />
          <SelectField label="الدور" value={form.role} onChange={(v) => set('role', v)} options={ROLE_OPTIONS} />
          <FieldGroup cols={2}>
            <TextField label="الهاتف" value={form.phone} onChange={(v) => set('phone', v)} />
            <TextField label="البريد الإلكتروني" value={form.email} onChange={(v) => set('email', v)} />
          </FieldGroup>
          <NumberField label="التكلفة اليومية" value={form.cost_per_day} onChange={(v) => set('cost_per_day', v)} required={false} />
          <ToggleField label="عضو نشط" checked={!!form.is_active} onChange={(v) => set('is_active', v)} />
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-md border border-line text-sm">إلغاء</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-md bg-navy-700 text-white text-sm disabled:opacity-60">{saving ? 'جارِ الحفظ…' : 'حفظ'}</button>
        </div>
      </div>
    </div>
  );
}

function AttendanceModal({ member, projectId, onClose }) {
  const [records, setRecords] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState('present');
  const [hours, setHours] = useState(8);

  async function load() {
    const res = await pmAttendance.list({ team_member_id: member.id });
    if (res.success) setRecords(res.attendance);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function add() {
    await pmAttendance.upsert({ team_member_id: member.id, project_id: projectId, date, status, hours });
    load();
  }
  async function remove(id) {
    await pmAttendance.remove(id);
    load();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-sheet border border-line bg-white shadow-sheet p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-navy-700 mb-4">حضور — {member.name}</h3>
        <div className="flex gap-1.5 mb-3">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="flex-1 rounded border border-line px-2 py-1.5 text-xs font-mono" dir="ltr" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border border-line px-2 py-1.5 text-xs">
            <option value="present">حاضر</option><option value="absent">غائب</option><option value="leave">إجازة</option>
          </select>
          <input type="number" value={hours} onChange={(e) => setHours(e.target.value)} className="w-16 rounded border border-line px-2 py-1.5 text-xs" placeholder="ساعات" />
          <button onClick={add} className="rounded bg-navy-600 text-white px-3 text-xs">حفظ</button>
        </div>
        <div className="max-h-64 overflow-y-auto divide-y divide-line">
          {records.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-xs py-1.5">
              <span className="font-mono tabular-figure" dir="ltr">{r.date}</span>
              <span>{{ present: 'حاضر', absent: 'غائب', leave: 'إجازة' }[r.status] || r.status} · {r.hours} س</span>
              <button onClick={() => remove(r.id)}><Trash2 size={12} className="text-ink-soft hover:text-fail-DEFAULT" /></button>
            </div>
          ))}
          {records.length === 0 && <p className="text-xs text-ink-soft py-3 text-center">لا يوجد سجل حضور بعد.</p>}
        </div>
        <div className="flex justify-end mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-md border border-line text-sm">إغلاق</button>
        </div>
      </div>
    </div>
  );
}
