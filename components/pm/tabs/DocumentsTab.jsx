'use client';
// components/pm/tabs/DocumentsTab.jsx

import { useEffect, useRef, useState } from 'react';
import { Upload, Trash2, Download, Check, X as XIcon, History } from 'lucide-react';
import { pmDocuments } from '@/lib/pmApi.js';
import { TextField } from '@/components/ui/Field.jsx';
import { Section, EmptyState, ConfirmDialog } from '@/components/pm/Shared.jsx';
import { GenericStatusBadge } from '@/components/pm/StatusBadge.jsx';

const STATUS_LABELS = { draft: 'مسودة', pending_approval: 'بانتظار الاعتماد', approved: 'معتمد', rejected: 'مرفوض' };

export default function DocumentsTab({ projectId }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [versionsFor, setVersionsFor] = useState(null);
  const [category, setCategory] = useState('');
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    const res = await pmDocuments.list(projectId);
    setLoading(false);
    if (res.success) setDocs(res.documents);
  }
  useEffect(() => { load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function upload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError('');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('project_id', projectId);
    fd.append('category', category);
    fd.append('name', file.name);
    const res = await pmDocuments.upload(fd);
    setUploading(false);
    if (res.success) load();
    else setError(res.error || 'تعذّر رفع الملف.');
    if (fileRef.current) fileRef.current.value = '';
  }

  async function approve(doc, approved) {
    await pmDocuments.approve(doc.id, approved);
    load();
  }

  async function remove() {
    await pmDocuments.remove(deleteTarget.id);
    setDeleteTarget(null);
    load();
  }

  return (
    <Section title={`المستندات (${docs.length})`} action={
      <div className="flex items-center gap-2">
        <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="التصنيف" className="w-28 rounded-md border border-line px-2 py-1.5 text-xs" />
        <label className="flex items-center gap-1.5 text-xs font-medium text-navy-700 hover:underline cursor-pointer">
          <Upload size={13} /> {uploading ? 'جارِ الرفع…' : 'رفع مستند'}
          <input ref={fileRef} type="file" className="hidden" onChange={upload} disabled={uploading} />
        </label>
      </div>
    }>
      {error && <p className="text-xs text-fail-700 mb-2">{error}</p>}
      {loading && <p className="text-sm text-ink-soft">جارِ التحميل…</p>}
      {!loading && docs.length === 0 && <EmptyState title="لا توجد مستندات بعد" message="ارفع المخططات والعقود والتقارير الخاصة بالمشروع." />}

      <div className="space-y-1.5">
        {docs.map((d) => (
          <div key={d.id} className="rounded-md border border-line p-2.5 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-ink text-sm truncate">{d.name}</span>
                <GenericStatusBadge status={d.status} labels={STATUS_LABELS} />
              </div>
              <p className="text-[11px] text-ink-soft mt-0.5">{d.category || 'بلا تصنيف'} · إصدار {d.version} · {formatSize(d.file_size)}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {d.status === 'pending_approval' && (
                <>
                  <button onClick={() => approve(d, true)} title="اعتماد"><Check size={14} className="text-pass-DEFAULT hover:text-pass-700" /></button>
                  <button onClick={() => approve(d, false)} title="رفض"><XIcon size={14} className="text-fail-DEFAULT hover:text-fail-700" /></button>
                </>
              )}
              <button onClick={() => setVersionsFor(d)} title="الإصدارات"><History size={13} className="text-ink-soft hover:text-navy-600" /></button>
              <a href={pmDocuments.downloadUrl(d.id)} title="تحميل"><Download size={13} className="text-ink-soft hover:text-navy-600" /></a>
              <button onClick={() => setDeleteTarget(d)}><Trash2 size={13} className="text-ink-soft hover:text-fail-DEFAULT" /></button>
            </div>
          </div>
        ))}
      </div>

      {versionsFor && <VersionsModal doc={versionsFor} onClose={() => setVersionsFor(null)} onChanged={load} />}
      <ConfirmDialog open={!!deleteTarget} title="حذف المستند؟" message="سيُحذف الملف نهائياً من القرص مع كل إصداراته." onConfirm={remove} onCancel={() => setDeleteTarget(null)} />
    </Section>
  );
}

function VersionsModal({ doc, onClose, onChanged }) {
  const [versions, setVersions] = useState([]);
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  async function load() {
    const res = await pmDocuments.get(doc.id);
    if (res.success) setVersions(res.versions);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function uploadVersion(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    await pmDocuments.addVersion(doc.id, fd);
    setUploading(false);
    load();
    onChanged();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-sheet border border-line bg-white shadow-sheet p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-navy-700">إصدارات — {doc.name}</h3>
          <label className="text-xs text-navy-600 hover:underline cursor-pointer flex items-center gap-1">
            <Upload size={12} /> {uploading ? 'جارِ الرفع…' : 'إصدار جديد'}
            <input ref={fileRef} type="file" className="hidden" onChange={uploadVersion} disabled={uploading} />
          </label>
        </div>
        <div className="divide-y divide-line max-h-72 overflow-y-auto">
          {versions.map((v) => (
            <div key={v.id} className="flex items-center justify-between text-xs py-2">
              <span>إصدار {v.version} — {formatSize(v.file_size)}</span>
              <span className="text-ink-soft font-mono tabular-figure" dir="ltr">{v.created_at?.slice(0, 10)}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-end mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-md border border-line text-sm">إغلاق</button>
        </div>
      </div>
    </div>
  );
}

function formatSize(bytes) {
  if (!bytes) return '0 KB';
  const kb = bytes / 1024;
  return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`;
}
