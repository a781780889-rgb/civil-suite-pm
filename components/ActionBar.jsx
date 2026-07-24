'use client';

import { useRef } from 'react';
import { Calculator, Save, FileDown, Image as ImageIcon, PenTool, Check, Loader2 } from 'lucide-react';

export default function ActionBar({
  onCalculate,
  calculating,
  onSave,
  saveStatus, // idle | saving | saved | error
  onExportPdf,
  exportStatus, // idle | exporting | error
  canSave,
  canExport,
  logoDataUrl,
  onLogoFile,
  signatureDataUrl,
  onSignatureFile,
}) {
  const logoInputRef = useRef(null);
  const sigInputRef = useRef(null);

  return (
    <div className="rounded-sheet border border-line bg-white p-3.5 flex flex-wrap items-center gap-2.5">
      <button
        onClick={onCalculate}
        disabled={calculating}
        className="inline-flex items-center gap-2 rounded-md bg-navy-700 hover:bg-navy-800 disabled:opacity-60 text-white text-sm font-bold px-4 py-2.5 transition-colors"
      >
        {calculating ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />}
        احسب
      </button>

      <button
        onClick={onSave}
        disabled={!canSave || saveStatus === 'saving'}
        className="inline-flex items-center gap-2 rounded-md border border-navy-600 text-navy-700 hover:bg-navy-50 disabled:opacity-40 text-sm font-semibold px-4 py-2.5 transition-colors"
      >
        {saveStatus === 'saving' ? (
          <Loader2 size={16} className="animate-spin" />
        ) : saveStatus === 'saved' ? (
          <Check size={16} className="text-pass" />
        ) : (
          <Save size={16} />
        )}
        {saveStatus === 'saved' ? 'تم الحفظ' : 'حفظ في قاعدة البيانات'}
      </button>

      <button
        onClick={onExportPdf}
        disabled={!canExport || exportStatus === 'exporting'}
        className="inline-flex items-center gap-2 rounded-md border border-rebar-600 text-rebar-600 hover:bg-rebar-50 disabled:opacity-40 text-sm font-semibold px-4 py-2.5 transition-colors"
      >
        {exportStatus === 'exporting' ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
        تصدير تقرير PDF
      </button>

      <div className="flex-1" />

      <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onLogoFile(e.target.files?.[0])} />
      <button
        onClick={() => logoInputRef.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-md border border-line text-ink-soft hover:text-ink hover:border-concrete-400 text-xs px-3 py-2 transition-colors"
        title="رفع شعار المشروع"
      >
        <ImageIcon size={14} />
        {logoDataUrl ? 'تغيير الشعار' : 'شعار المشروع'}
      </button>

      <input ref={sigInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onSignatureFile(e.target.files?.[0])} />
      <button
        onClick={() => sigInputRef.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-md border border-line text-ink-soft hover:text-ink hover:border-concrete-400 text-xs px-3 py-2 transition-colors"
        title="رفع توقيع المهندس"
      >
        <PenTool size={14} />
        {signatureDataUrl ? 'تغيير التوقيع' : 'توقيع المهندس'}
      </button>
    </div>
  );
}
