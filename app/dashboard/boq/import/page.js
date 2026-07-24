'use client';

import { useState, useEffect } from 'react';
import { Upload, FileDown, AlertCircle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { previewBoqImport, buildBoqRowsFromGeometry, confirmBoqImport, boqImportTemplateUrl, fetchBoqCategories } from '@/lib/api.js';
import { TRADES } from '@/lib/boq/categoryRegistry.js';
import ProjectPicker, { useSelectedProject } from '@/components/boq/ProjectPicker.jsx';

export default function BoqImportPage() {
  const { projects, projectId, select, addProject } = useSelectedProject();
  const [categories, setCategories] = useState([]);
  const [step, setStep] = useState('upload');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null); // نتيجة /preview
  const [mapping, setMapping] = useState({}); // للـ DXF/IFC: layer/ifcType -> category_key
  const [rowsPreview, setRowsPreview] = useState(null); // شكل موحّد {valid, rejected, totalRows} بعد التعيين
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileMeta, setFileMeta] = useState(null);

  useEffect(() => { fetchBoqCategories().then((res) => { if (res.success) setCategories(res.categories); }); }, []);

  const handleFile = async (file) => {
    if (!file) return;
    setBusy(true); setError(''); setPreview(null); setRowsPreview(null); setResult(null);
    setFileMeta({ name: file.name, type: file.name.split('.').pop()?.toLowerCase() });
    const res = await previewBoqImport(file, { unitScale: 0.001 });
    setBusy(false);
    if (!res.success) { setError(res.errors?.[0] || 'تعذّرت معالجة الملف.'); return; }
    setPreview(res);
    if (res.kind === 'rows') setRowsPreview(res);
    setStep('preview');
  };

  const buildFromMapping = async () => {
    setBusy(true); setError('');
    let items = [];
    if (preview.kind === 'dxf_layers') {
      items = preview.layers
        .filter((l) => mapping[l.layer])
        .map((l) => {
          const category = categories.find((c) => c.key === mapping[l.layer]);
          const netQuantity = category?.unit === 'm2' ? l.areaM2 : l.lengthM;
          return { category_key: mapping[l.layer], name: `${l.layer} (من DXF)`, netQuantity, sourceLabel: `طبقة DXF: ${l.layer}` };
        });
    } else if (preview.kind === 'ifc_elements') {
      items = preview.elements
        .filter((el) => mapping[el.ifcId])
        .map((el) => {
          const category = categories.find((c) => c.key === mapping[el.ifcId]);
          const q = el.quantities.find((qq) => unitKindMatches(qq.kind, category?.unit));
          return { category_key: mapping[el.ifcId], name: el.name, netQuantity: q?.value, sourceLabel: `IFC: ${el.ifcType} #${el.ifcId}` };
        });
    }
    const res = await buildBoqRowsFromGeometry(items);
    setBusy(false);
    if (!res.success) { setError(res.errors?.[0] || 'تعذّرت معالجة العناصر.'); return; }
    setRowsPreview(res);
  };

  const doConfirm = async (allowDuplicates = false) => {
    setBusy(true); setError('');
    const res = await confirmBoqImport({
      project_id: projectId || null,
      rows: rowsPreview.valid,
      fileName: fileMeta?.name,
      fileType: fileMeta?.type,
      allowDuplicates,
      preRejected: rowsPreview.rejected,
    });
    setBusy(false);
    if (!res.success) { setError(res.errors?.[0] || 'تعذّر إتمام الاستيراد.'); return; }
    setResult(res);
    setStep('done');
  };

  const reset = () => { setStep('upload'); setPreview(null); setRowsPreview(null); setResult(null); setMapping({}); setError(''); };

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-700">استيراد حصر الكميات</h1>
          <p className="text-ink-soft text-sm mt-1">Excel، CSV, DXF، IFC — كل الأشكال تمر بمعاينة قبل الاعتماد النهائي</p>
        </div>
        <ProjectPicker projects={projects} projectId={projectId} onSelect={select} onCreate={addProject} />
      </div>

      {step === 'upload' && (
        <div className="space-y-4">
          <div className="flex gap-2 text-sm">
            <a href={boqImportTemplateUrl('excel')} className="flex items-center gap-1.5 text-navy-600 font-bold hover:underline"><FileDown size={14} /> نموذج Excel</a>
            <a href={boqImportTemplateUrl('csv')} className="flex items-center gap-1.5 text-navy-600 font-bold hover:underline"><FileDown size={14} /> نموذج CSV</a>
          </div>
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
            className={`flex flex-col items-center justify-center gap-2 rounded-sheet border-2 border-dashed p-12 cursor-pointer transition-colors ${dragOver ? 'border-navy-500 bg-navy-50' : 'border-line bg-white'}`}
          >
            <Upload size={28} className="text-navy-400" />
            <span className="text-sm font-medium text-ink">اسحب ملفاً هنا أو انقر للاختيار</span>
            <span className="text-xs text-ink-soft">.xlsx .csv .dxf .ifc — الحد الأقصى الموصى به 10MB</span>
            <input type="file" accept=".xlsx,.xls,.csv,.dxf,.ifc" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
          </label>
          {busy && <div className="flex items-center gap-2 text-sm text-navy-600"><Loader2 size={15} className="animate-spin" /> جارٍ تحليل الملف...</div>}
          {error && <ErrorBox message={error} />}
        </div>
      )}

      {step === 'preview' && preview && (
        <div className="space-y-4">
          {preview.kind === 'rows' && (
            <RowsPreview rowsPreview={rowsPreview} onConfirm={doConfirm} busy={busy} error={error} onBack={reset} />
          )}

          {(preview.kind === 'dxf_layers' || preview.kind === 'ifc_elements') && !rowsPreview && (
            <div className="space-y-3">
              <p className="text-sm text-ink-soft">
                {preview.kind === 'dxf_layers'
                  ? `تم العثور على ${preview.layers.length} طبقة في الملف. اختر صنف حصر الكميات المناسب لكل طبقة تريد استيرادها (اتركها بلا اختيار لتجاهلها).`
                  : `تم العثور على ${preview.summary.length} نوع كيان IFC. اختر صنف حصر الكميات المناسب لكل نوع (يظهر الاقتراح المبدئي تلقائياً إن وُجد).`}
              </p>
              {preview.kind === 'dxf_layers' && preview.insUnitsHint && (
                <div className="text-xs bg-navy-50 border border-navy-200 rounded-md px-3 py-2 text-navy-700">
                  رأس الملف يقترح أن وحدة الرسم: {preview.insUnitsHint.label} — تأكد من مطابقة ذلك مع القيم أدناه.
                </div>
              )}
              <div className="rounded-sheet border border-line bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-concrete-50 text-ink-soft text-xs">
                    <tr>
                      <th className="text-right px-3 py-2">{preview.kind === 'dxf_layers' ? 'الطبقة' : 'نوع الكيان'}</th>
                      <th className="text-right px-3 py-2">{preview.kind === 'dxf_layers' ? 'الطول / المساحة' : 'العدد / بكميات'}</th>
                      <th className="text-right px-3 py-2">صنف BOQ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {preview.kind === 'dxf_layers' && preview.layers.map((l) => (
                      <tr key={l.layer}>
                        <td className="px-3 py-2 font-medium">{l.layer} <span className="text-xs text-ink-soft">({l.entityCount} كيان)</span></td>
                        <td className="px-3 py-2 font-mono text-xs" dir="ltr">{l.lengthM}م طول / {l.areaM2}م² مساحة</td>
                        <td className="px-3 py-2"><CategorySelect categories={categories} value={mapping[l.layer] || ''} onChange={(v) => setMapping((m) => ({ ...m, [l.layer]: v }))} /></td>
                      </tr>
                    ))}
                    {preview.kind === 'ifc_elements' && preview.summary.map((s) => (
                      <tr key={s.ifcType}>
                        <td className="px-3 py-2 font-medium">{s.ifcType} <span className="text-xs text-ink-soft">({s.sampleNames.join('، ')})</span></td>
                        <td className="px-3 py-2 text-xs text-ink-soft">{s.count} عنصر — {s.withQuantities} منها بكمية معروفة من الملف</td>
                        <td className="px-3 py-2">
                          <CategorySelect
                            categories={categories}
                            value={mapping[`__type_${s.ifcType}`] || s.suggestedCategoryKey || ''}
                            onChange={(v) => {
                              const ids = preview.elements.filter((el) => el.ifcType === s.ifcType).map((el) => el.ifcId);
                              setMapping((m) => { const next = { ...m, [`__type_${s.ifcType}`]: v }; ids.forEach((id) => { next[id] = v; }); return next; });
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {error && <ErrorBox message={error} />}
              <div className="flex items-center justify-between">
                <button onClick={reset} className="text-sm text-ink-soft flex items-center gap-1"><ArrowRight size={14} /> رجوع</button>
                <button onClick={buildFromMapping} disabled={busy} className="bg-navy-600 hover:bg-navy-700 text-white text-sm font-bold px-5 py-2 rounded-md disabled:opacity-50">
                  {busy ? 'جارٍ الحساب...' : 'معاينة الكميات المُستخرجة'}
                </button>
              </div>
            </div>
          )}

          {(preview.kind === 'dxf_layers' || preview.kind === 'ifc_elements') && rowsPreview && (
            <RowsPreview rowsPreview={rowsPreview} onConfirm={doConfirm} busy={busy} error={error} onBack={() => setRowsPreview(null)} />
          )}
        </div>
      )}

      {step === 'done' && result && (
        <div className="rounded-sheet border border-line bg-white p-6 text-center space-y-3">
          <CheckCircle2 size={36} className="mx-auto text-emerald-600" />
          <h2 className="font-bold text-navy-700">تم الاستيراد</h2>
          <p className="text-sm text-ink-soft">أُضيف {result.importedCount} عنصر بنجاح{result.skipped?.length ? `، وتم تجاوز ${result.skipped.length} صف مكرر أو غير صالح` : ''}.</p>
          {result.skipped?.length > 0 && (
            <div className="text-right text-xs bg-amber-50 border border-amber-200 rounded-md p-3 max-h-40 overflow-y-auto">
              {result.skipped.map((s, i) => <div key={i} className="py-0.5">صف {s.row}: {s.reason}</div>)}
            </div>
          )}
          <button onClick={reset} className="bg-navy-600 hover:bg-navy-700 text-white text-sm font-bold px-5 py-2 rounded-md">استيراد ملف آخر</button>
        </div>
      )}
    </div>
  );
}

function RowsPreview({ rowsPreview, onConfirm, busy, error, onBack }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-4 text-sm">
        <span className="text-emerald-700 font-bold">{rowsPreview.valid.length} صف صالح</span>
        {rowsPreview.rejected.length > 0 && <span className="text-rebar-700 font-bold">{rowsPreview.rejected.length} صف مرفوض</span>}
      </div>
      {rowsPreview.rejected.length > 0 && (
        <div className="text-xs bg-rebar-50 border border-rebar-200 rounded-md p-3 max-h-40 overflow-y-auto space-y-0.5">
          {rowsPreview.rejected.map((r, i) => <div key={i}>صف {r.row}: {r.reason}</div>)}
        </div>
      )}
      {rowsPreview.valid.length > 0 && (
        <div className="rounded-sheet border border-line bg-white overflow-hidden max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-concrete-50 text-ink-soft text-xs sticky top-0"><tr><th className="text-right px-3 py-2">الاسم</th><th className="text-right px-3 py-2">الكمية</th><th className="text-right px-3 py-2">التكلفة</th></tr></thead>
            <tbody className="divide-y divide-line">
              {rowsPreview.valid.map((r, i) => (
                <tr key={i}><td className="px-3 py-2">{r.name}</td><td className="px-3 py-2 font-mono" dir="ltr">{r.quantity_with_waste} {r.unit}</td><td className="px-3 py-2 font-mono" dir="ltr">{r.total_cost}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {error && <ErrorBox message={error} />}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-ink-soft flex items-center gap-1"><ArrowRight size={14} /> رجوع</button>
        <button onClick={() => onConfirm(false)} disabled={busy || !rowsPreview.valid.length} className="bg-navy-600 hover:bg-navy-700 text-white text-sm font-bold px-5 py-2 rounded-md disabled:opacity-50">
          {busy ? 'جارٍ الاستيراد...' : `اعتماد استيراد ${rowsPreview.valid.length} عنصر`}
        </button>
      </div>
    </div>
  );
}

function CategorySelect({ categories, value, onChange }) {
  const byTrade = {};
  categories.forEach((c) => { (byTrade[c.trade] = byTrade[c.trade] || []).push(c); });
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="text-sm border border-line rounded-md px-2 py-1.5 bg-white min-w-[180px]">
      <option value="">— تجاهل —</option>
      {Object.entries(byTrade).map(([trade, cats]) => (
        <optgroup key={trade} label={TRADES[trade]?.label_ar || trade}>
          {cats.map((c) => <option key={c.key} value={c.key}>{c.name_ar}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

function ErrorBox({ message }) {
  return <div className="flex items-start gap-2 text-sm text-rebar-700 bg-rebar-50 border border-rebar-200 rounded-md p-3"><AlertCircle size={16} className="shrink-0 mt-0.5" />{message}</div>;
}

function unitKindMatches(kind, unit) {
  return { length: 'm', area: 'm2', volume: 'm3', weight: 'kg', count: 'ea' }[kind] === unit;
}
