'use client';
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { FieldGroup, TextField, SelectField } from '@/components/ui/Field.jsx';
import { DateField, TextAreaField } from '@/components/pm/PmField.jsx';
import { createCorrespondence, updateCorrespondence, listClients } from '@/lib/businessApi.js';

const EMPTY = { ref_no: '', direction: 'outgoing', client_id: '', subject: '', body: '', sender: '', recipient: '', correspondence_date: '', status: 'open' };

export default function CorrespondenceFormModal({ open, onClose, onSaved, item }) {
  const [form, setForm] = useState(EMPTY);
  const [clients, setClients] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setForm(item ? { ...EMPTY, ...item } : EMPTY);
    setError(null);
    listClients({ pageSize: 500 }).then((r) => setClients(r.rows)).catch(() => {});
  }, [open, item]);

  function set(field) { return (v) => setForm((f) => ({ ...f, [field]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      if (item) await updateCorrespondence(item.id, form);
      else await createCorrespondence(form);
      onSaved?.();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-navy-900/40" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line sticky top-0 bg-white">
          <h2 className="font-bold text-ink">{item ? 'تعديل المراسلة' : 'مراسلة جديدة'}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-line text-ink-soft"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="text-sm text-fail bg-fail/10 rounded-md px-3 py-2">{error}</div>}
          <FieldGroup cols={2}>
            <TextField label="الموضوع" value={form.subject} onChange={set('subject')} required />
            <TextField label="رقم المراسلة" value={form.ref_no} onChange={set('ref_no')} />
            <SelectField label="الاتجاه" value={form.direction} onChange={set('direction')} options={[{ value: 'outgoing', label: 'صادر' }, { value: 'incoming', label: 'وارد' }, { value: 'internal', label: 'داخلي' }, { value: 'email', label: 'بريد إلكتروني' }, { value: 'notice', label: 'إشعار' }]} />
            <SelectField label="العميل" value={form.client_id} onChange={set('client_id')} options={[{ value: '', label: 'بدون' }, ...clients.map((c) => ({ value: c.id, label: c.name }))]} />
            <TextField label="المرسل" value={form.sender} onChange={set('sender')} />
            <TextField label="المستلم" value={form.recipient} onChange={set('recipient')} />
            <DateField label="التاريخ" value={form.correspondence_date} onChange={set('correspondence_date')} />
            <SelectField label="الحالة" value={form.status} onChange={set('status')} options={[{ value: 'open', label: 'مفتوح' }, { value: 'pending_reply', label: 'بانتظار الرد' }, { value: 'closed', label: 'مغلق' }]} />
          </FieldGroup>
          <TextAreaField label="المحتوى" value={form.body} onChange={set('body')} rows={4} />
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="text-sm font-medium px-4 py-2 rounded-md border border-line text-ink hover:bg-line/50">إلغاء</button>
            <button type="submit" disabled={saving} className="text-sm font-medium px-4 py-2 rounded-md bg-navy text-white hover:bg-navy-600 disabled:opacity-50">{saving ? 'جارٍ الحفظ...' : 'حفظ'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
