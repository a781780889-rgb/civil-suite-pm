'use client';
import { useEffect, useState } from 'react';
import { Plus, ChevronDown, ChevronUp, CheckCircle2, XCircle, Send, Award, Lock } from 'lucide-react';
import { Section, EmptyState } from '@/components/pm/Shared.jsx';
import { FieldGroup, TextField, SelectField } from '@/components/ui/Field.jsx';
import { DateField, TextAreaField } from '@/components/pm/PmField.jsx';
import { StatusBadge } from '@/components/hse/StatusBadge.jsx';
import { INSPECTION_TYPE_OPTIONS, INSPECTION_RESULT_OPTIONS, optionLabel } from '@/lib/hseConstants.js';
import * as hseApi from '@/lib/hseApi.js';

const EMPTY = { inspection_type: 'general_safety_walk', inspection_date: '', location: '', inspector: '', itemsText: '' };

export default function InspectionsTab({ projectId }) {
  const [inspections, setInspections] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function load() { const res = await hseApi.listInspections({ project_id: projectId, pageSize: 100 }); setInspections(res.rows); }
  useEffect(() => { load(); }, [projectId]);

  async function toggleExpand(id) {
    if (expanded === id) { setExpanded(null); return; }
    const res = await hseApi.getInspection(id);
    setDetail(res.inspection); setExpanded(id);
  }

  async function handleCreate(e) {
    e.preventDefault(); setSaving(true); setError(null);
    try {
      const items = form.itemsText.split('\n').map((t) => t.trim()).filter(Boolean).map((item_text) => ({ item_text }));
      await hseApi.createInspection({ ...form, project_id: projectId, items });
      setForm(EMPTY); setShowForm(false); load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function recordResult(inspectionId, itemId, is_compliant) {
    await hseApi.recordInspectionItemResult(inspectionId, itemId, { is_compliant });
    const res = await hseApi.getInspection(inspectionId); setDetail(res.inspection); load();
  }

  async function act(fn, id, ...args) {
    setError(null);
    try { await fn(id, ...args); const res = await hseApi.getInspection(id); setDetail(res.inspection); load(); }
    catch (err) { setError(err.message); }
  }

  return (
    <Section title="التفتيشات الميدانية" action={
      <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-1 rounded-sheet bg-navy-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-800">
        <Plus size={15} /> تفتيش جديد
      </button>
    }>
      {error && <p className="mb-3 rounded-sheet bg-fail-50 p-2 text-sm text-fail-700">{error}</p>}
      {showForm && (
        <form onSubmit={handleCreate} className="mb-4 space-y-3 rounded-sheet border border-line bg-paper p-4">
          <FieldGroup cols={2}>
            <SelectField label="نوع التفتيش" value={form.inspection_type} onChange={(v) => setForm({ ...form, inspection_type: v })} options={INSPECTION_TYPE_OPTIONS} />
            <DateField label="تاريخ التفتيش" value={form.inspection_date} onChange={(v) => setForm({ ...form, inspection_date: v })} required />
            <TextField label="الموقع" value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
            <TextField label="المفتِّش" value={form.inspector} onChange={(v) => setForm({ ...form, inspector: v })} />
          </FieldGroup>
          <TextAreaField label="بنود قائمة التحقق (سطر لكل بند)" value={form.itemsText} onChange={(v) => setForm({ ...form, itemsText: v })} rows={5} placeholder={'مثال:\nالسقالات مثبتة بإحكام\nخوذ السلامة مرتداة من الجميع\nمخارج الطوارئ غير مسدودة'} />
          <button type="submit" disabled={saving} className="rounded-sheet bg-navy-700 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-50">
            {saving ? 'جارٍ الحفظ...' : 'حفظ التفتيش'}
          </button>
        </form>
      )}

      {inspections.length === 0 ? <EmptyState title="لا تفتيشات" message="أنشئ أول تفتيش لهذا المشروع." /> : (
        <div className="space-y-2">
          {inspections.map((i) => (
            <div key={i.id} className="rounded-sheet border border-line bg-white">
              <button onClick={() => toggleExpand(i.id)} className="flex w-full items-center justify-between p-3 text-right">
                <div>
                  <p className="font-semibold text-ink">{i.inspection_no} — {optionLabel(INSPECTION_TYPE_OPTIONS, i.inspection_type)}</p>
                  <p className="text-xs text-ink-soft">{i.inspection_date} {i.location ? `· ${i.location}` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={i.overall_result} small /> <StatusBadge status={i.status} small />
                  {expanded === i.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>
              {expanded === i.id && detail && (
                <div className="space-y-3 border-t border-line p-3">
                  <ul className="space-y-1.5">
                    {detail.items?.map((item) => (
                      <li key={item.id} className="flex items-center justify-between rounded bg-paper px-2 py-1.5 text-sm">
                        <span>{item.item_text}</span>
                        <div className="flex items-center gap-2">
                          {item.is_compliant === 1 && <CheckCircle2 size={16} className="text-pass-DEFAULT" />}
                          {item.is_compliant === 0 && <XCircle size={16} className="text-fail-DEFAULT" />}
                          {item.is_compliant === null && detail.status === 'draft' && (
                            <>
                              <button onClick={() => recordResult(detail.id, item.id, true)} className="text-xs text-pass-700 hover:underline">مطابق</button>
                              <button onClick={() => recordResult(detail.id, item.id, false)} className="text-xs text-fail-700 hover:underline">غير مطابق</button>
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-3 text-xs">
                    {detail.status === 'draft' && (
                      <button onClick={() => act(hseApi.completeInspection, detail.id)} className="flex items-center gap-1 text-navy-600 hover:underline"><Send size={12} /> إنهاء التسجيل</button>
                    )}
                    {detail.status === 'completed' && (
                      <button onClick={() => act(hseApi.approveInspection, detail.id, 'مسؤول السلامة')} className="flex items-center gap-1 text-pass-700 hover:underline"><Award size={12} /> اعتماد النتائج</button>
                    )}
                    {detail.status === 'approved' && (
                      <button onClick={() => act(hseApi.closeInspection, detail.id)} className="flex items-center gap-1 text-ink-soft hover:underline"><Lock size={12} /> إغلاق</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
