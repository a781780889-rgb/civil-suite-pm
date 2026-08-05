'use client';
import { useEffect, useRef, useState } from 'react';
import { Upload, Trash2, FileText, Download } from 'lucide-react';
import { Section, EmptyState } from '@/components/pm/Shared.jsx';
import { SelectField } from '@/components/ui/Field.jsx';
import { DOCUMENT_TYPE_OPTIONS } from '@/lib/equipmentConstants.js';
import { listDocuments, uploadDocument, deleteDocument, documentDownloadUrl } from '@/lib/equipmentApi.js';

export default function DocumentsTab({ equipment }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [docType, setDocType] = useState('other');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  async function load() {
    setLoading(true);
    const res = await listDocuments(equipment.id);
    setDocuments(res.documents || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [equipment.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError('');
    try {
      const formData = new FormData();
      formData.set('file', file);
      formData.set('equipment_id', String(equipment.id));
      formData.set('doc_type', docType);
      await uploadDocument(formData);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleDelete(id) {
    await deleteDocument(id);
    load();
  }

  return (
    <div className="space-y-4">
      <Section title={`المستندات والصور (${documents.length})`} action={
        <div className="flex items-center gap-2">
          <div className="w-40"><SelectField value={docType} onChange={setDocType} options={DOCUMENT_TYPE_OPTIONS} /></div>
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-navy text-white hover:bg-navy-600 disabled:opacity-50">
            <Upload size={13} /> {uploading ? 'جارِ الرفع...' : 'رفع ملف'}
          </button>
          <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} />
        </div>
      }>
        {error && <div className="text-sm text-fail bg-fail/10 rounded-md px-3 py-2 mb-3">{error}</div>}
        {!loading && documents.length === 0 && <EmptyState title="لا توجد مستندات مرفوعة بعد" />}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {documents.map((d) => (
            <div key={d.id} className="rounded-md border border-line p-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={16} className="text-ink-soft shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink truncate">{d.original_name}</div>
                  <div className="text-[11px] text-ink-soft">{DOCUMENT_TYPE_OPTIONS.find((t) => t.value === d.doc_type)?.label || d.doc_type}</div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a href={documentDownloadUrl(d.id)} target="_blank" rel="noreferrer" className="p-1.5 rounded hover:bg-line text-ink-soft"><Download size={14} /></a>
                <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded hover:bg-fail/10 text-fail"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
