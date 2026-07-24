'use client';
// components/pm/tabs/BudgetTab.jsx

import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, TrendingUp, TrendingDown, Wallet, AlertTriangle } from 'lucide-react';
import { pmBudget } from '@/lib/pmApi.js';
import { TextField, SelectField, NumberField, FieldGroup } from '@/components/ui/Field.jsx';
import { DateField } from '@/components/pm/PmField.jsx';
import { Section, EmptyState, ConfirmDialog, StatCard } from '@/components/pm/Shared.jsx';

const TYPE_LABELS = { expense: 'مصروف', revenue: 'إيراد', purchase_order: 'أمر شراء', change_order: 'أمر تغيير' };
const TYPE_OPTIONS = Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }));

export default function BudgetTab({ projectId, project }) {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function load() {
    setLoading(true);
    const [iRes, sRes] = await Promise.all([pmBudget.list(projectId), pmBudget.summary(projectId)]);
    setLoading(false);
    if (iRes.success) setItems(iRes.items);
    if (sRes.success) setSummary(sRes.summary);
  }
  useEffect(() => { load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function remove() {
    await pmBudget.remove(deleteTarget.id);
    setDeleteTarget(null);
    load();
  }

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={Wallet} label="الميزانية الحالية" value={`${fmt(summary.currentBudget)} ${project.currency}`} small />
          <StatCard icon={TrendingDown} label="المصروفات" value={`${fmt(summary.totalExpenses)} ${project.currency}`} tone="fail" small />
          <StatCard icon={TrendingUp} label="الإيرادات" value={`${fmt(summary.totalRevenue)} ${project.currency}`} tone="pass" small />
          <StatCard icon={AlertTriangle} label="نسبة الصرف" value={`${summary.spentPct}%`} tone={summary.isOverBudget ? 'fail' : 'navy'} small />
          <StatCard label="الانحراف المالي" value={`${fmt(summary.deviation)} ${project.currency}`} tone={summary.deviation < 0 ? 'fail' : 'pass'} small />
          <StatCard label="الربح/الخسارة" value={`${fmt(summary.profitLoss)} ${project.currency}`} tone={summary.profitLoss < 0 ? 'fail' : 'pass'} small />
          <StatCard label="مُلتزم به (أوامر شراء)" value={`${fmt(summary.totalCommitted)} ${project.currency}`} small />
          <StatCard label="الربح المتوقع عند الالتزام بالميزانية" value={`${fmt(summary.projectedProfitAtBudget)} ${project.currency}`} small />
        </div>
      )}

      <Section title={`البنود المالية (${items.length})`} action={
        <button onClick={() => setEditing({ project_id: projectId, item_type: 'expense' })} className="flex items-center gap-1.5 text-xs font-medium text-navy-700 hover:underline">
          <Plus size={13} /> بند جديد
        </button>
      }>
        {loading && <p className="text-sm text-ink-soft">جارِ التحميل…</p>}
        {!loading && items.length === 0 && <EmptyState title="لا توجد بنود مالية بعد" />}
        <div className="divide-y divide-line">
          {items.map((it) => (
            <div key={it.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ml-2 ${it.item_type === 'expense' ? 'bg-fail-DEFAULT' : it.item_type === 'revenue' ? 'bg-pass-DEFAULT' : 'bg-navy-400'}`} />
                <span className="text-ink font-medium">{TYPE_LABELS[it.item_type]}</span>
                {it.category && <span className="text-ink-soft"> — {it.category}</span>}
                {it.description && <span className="text-ink-soft text-xs block truncate">{it.description}</span>}
              </div>
              <span className="text-xs text-ink-soft font-mono tabular-figure shrink-0" dir="ltr">{it.date}</span>
              <span className="font-mono tabular-figure font-bold text-ink shrink-0 w-28 text-left" dir="ltr">{fmt(it.amount)}</span>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => setEditing(it)}><Pencil size={13} className="text-ink-soft hover:text-navy-600" /></button>
                <button onClick={() => setDeleteTarget(it)}><Trash2 size={13} className="text-ink-soft hover:text-fail-DEFAULT" /></button>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {editing && <BudgetItemModal item={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      <ConfirmDialog open={!!deleteTarget} title="حذف البند المالي؟" onConfirm={remove} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}

function BudgetItemModal({ item, onClose, onSaved }) {
  const isNew = !item.id;
  const [form, setForm] = useState({ item_type: 'expense', category: '', description: '', amount: '', date: new Date().toISOString().slice(0, 10), reference_no: '', ...item });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    if (!form.amount) { setError('المبلغ مطلوب.'); return; }
    setSaving(true); setError('');
    const res = isNew ? await pmBudget.create(form) : await pmBudget.update(item.id, form);
    setSaving(false);
    if (res.success) onSaved();
    else setError(res.error || 'تعذّر الحفظ.');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-sheet border border-line bg-white shadow-sheet p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-navy-700 mb-4">{isNew ? 'بند مالي جديد' : 'تعديل البند'}</h3>
        {error && <p className="text-xs text-fail-700 mb-2">{error}</p>}
        <div className="space-y-3">
          <SelectField label="النوع" value={form.item_type} onChange={(v) => set('item_type', v)} options={TYPE_OPTIONS} />
          {form.item_type === 'change_order' && (
            <SelectField label="يؤثر على" value={form.category || 'budget'} onChange={(v) => set('category', v)} options={[{ value: 'budget', label: 'الميزانية' }, { value: 'contract', label: 'قيمة العقد' }]} />
          )}
          {form.item_type !== 'change_order' && <TextField label="التصنيف" value={form.category} onChange={(v) => set('category', v)} placeholder="مواد، عمالة، دفعة مقدمة…" />}
          <TextField label="الوصف" value={form.description} onChange={(v) => set('description', v)} />
          <FieldGroup cols={2}>
            <NumberField label="المبلغ" value={form.amount} onChange={(v) => set('amount', v)} />
            <DateField label="التاريخ" value={form.date} onChange={(v) => set('date', v)} />
          </FieldGroup>
          <TextField label="رقم مرجعي" value={form.reference_no} onChange={(v) => set('reference_no', v)} />
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-md border border-line text-sm">إلغاء</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-md bg-navy-700 text-white text-sm disabled:opacity-60">{saving ? 'جارِ الحفظ…' : 'حفظ'}</button>
        </div>
      </div>
    </div>
  );
}

function fmt(n) { return Number(n || 0).toLocaleString('en-US'); }
