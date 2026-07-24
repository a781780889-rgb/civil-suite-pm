'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Upload, Loader2, AlertCircle, Check, X, Info } from 'lucide-react';
import { analyzeDrawingApi, fetchBoqCategories, createBoqElementApi } from '@/lib/api.js';
import ProjectPicker, { useSelectedProject } from '@/components/boq/ProjectPicker.jsx';

export default function BoqAiPage() {
  const { projects, projectId, select, addProject } = useSelectedProject();
  const [categories, setCategories] = useState([]);
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState(null);
  const [addingIndex, setAddingIndex] = useState(null);
  const [addedIndexes, setAddedIndexes] = useState(new Set());

  useEffect(() => { fetchBoqCategories().then((res) => { if (res.success) setCategories(res.categories); }); }, []);

  const onFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setImageDataUrl(reader.result); setSuggestions(null); setAddedIndexes(new Set()); };
    reader.readAsDataURL(file);
  };

  const analyze = async () => {
    setBusy(true); setError(''); setSuggestions(null);
    const [, mediaType, base64] = imageDataUrl.match(/^data:(.+);base64,(.+)$/) || [];
    const res = await analyzeDrawingApi({ imageBase64: base64, mediaType, notes });
    setBusy(false);
    if (!res.success) { setError(res.errors?.[0] || 'تعذّر تحليل المخطط.'); return; }
    setSuggestions(res.suggestions);
  };

  const addSuggestion = async (s, idx) => {
    setAddingIndex(idx);
    const res = await createBoqElementApi({
      project_id: projectId || null,
      category_key: s.suggestedCategoryKey,
      name: s.elementLabel || 'عنصر مقترح من الذكاء الاصطناعي',
      dimensions: s.dimensions,
      source: 'ai',
      notes: `اقتراح ذكاء اصطناعي (ثقة ${Math.round(s.confidence * 100)}%): ${s.reasoning}`,
      allowDuplicate: true,
    });
    setAddingIndex(null);
    if (res.success) setAddedIndexes((prev) => new Set(prev).add(idx));
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-700 flex items-center gap-2"><Sparkles size={22} className="text-navy-500" /> مساعد الذكاء الاصطناعي لتحليل المخططات</h1>
          <p className="text-ink-soft text-sm mt-1">اقتراحات أولية فقط — لا تُضاف لحصر الكميات إلا بعد مراجعتك واعتمادك لكل عنصر يدوياً</p>
        </div>
        <ProjectPicker projects={projects} projectId={projectId} onSelect={select} onCreate={addProject} />
      </div>

      <div className="flex items-start gap-2 text-xs bg-navy-50 border border-navy-200 rounded-md p-3 text-navy-700">
        <Info size={15} className="shrink-0 mt-0.5" />
        <span>يقرأ المساعد فقط الأبعاد المكتوبة صراحةً على المخطط ولا يخترع أرقاماً غير موجودة. راجع مستوى الثقة ومبرر كل اقتراح قبل اعتماده — خصوصاً الاقتراحات ذات الثقة المنخفضة.</span>
      </div>

      <label className="flex flex-col items-center justify-center gap-2 rounded-sheet border-2 border-dashed border-line bg-white p-8 cursor-pointer hover:border-navy-400">
        {imageDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageDataUrl} alt="المخطط المرفوع" className="max-h-64 rounded-md" />
        ) : (
          <>
            <Upload size={26} className="text-navy-400" />
            <span className="text-sm text-ink">ارفع صورة أو لقطة شاشة من المخطط</span>
          </>
        )}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="ملاحظات إضافية (اختياري) — مثال: هذا مخطط قواعد الدور الأرضي فقط"
        className="w-full rounded-md border border-line px-3 py-2 text-sm"
        rows={2}
      />

      <button onClick={analyze} disabled={!imageDataUrl || busy} className="flex items-center gap-2 bg-navy-600 hover:bg-navy-700 text-white text-sm font-bold px-5 py-2.5 rounded-md disabled:opacity-50">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} تحليل المخطط
      </button>

      {error && (
        <div className="flex items-start gap-2 text-sm text-rebar-700 bg-rebar-50 border border-rebar-200 rounded-md p-3">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {suggestions && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-navy-700">{suggestions.length} اقتراح</h2>
          {suggestions.length === 0 && <p className="text-sm text-ink-soft">لم يتعرّف المساعد على عناصر بأبعاد واضحة في هذه الصورة.</p>}
          {suggestions.map((s, idx) => {
            const category = categories.find((c) => c.key === s.suggestedCategoryKey);
            const confidencePct = Math.round(s.confidence * 100);
            const confidenceColor = confidencePct >= 70 ? 'bg-emerald-500' : confidencePct >= 40 ? 'bg-amber-500' : 'bg-rebar-500';
            return (
              <div key={idx} className="rounded-sheet border border-line bg-white p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-ink">{s.elementLabel || 'عنصر بلا تسمية على المخطط'}</span>
                  <span className="flex items-center gap-1.5 text-xs">
                    <span className={`w-2 h-2 rounded-full ${confidenceColor}`} />
                    ثقة {confidencePct}%
                  </span>
                </div>
                <div className="text-xs text-ink-soft">الصنف المقترح: {category?.name_ar || 'غير محدَّد — يتطلب اختياراً يدوياً'}</div>
                {Object.keys(s.dimensions || {}).length > 0 && (
                  <div className="flex flex-wrap gap-2 text-xs font-mono" dir="ltr">
                    {Object.entries(s.dimensions).map(([k, v]) => <span key={k} className="bg-concrete-100 rounded px-2 py-0.5">{k}: {v}</span>)}
                  </div>
                )}
                {s.reasoning && <p className="text-xs text-ink-soft">{s.reasoning}</p>}
                <div className="flex items-center gap-2 pt-1">
                  {addedIndexes.has(idx) ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-700"><Check size={14} /> أُضيف لحصر الكميات</span>
                  ) : (
                    <>
                      <button
                        onClick={() => addSuggestion(s, idx)}
                        disabled={!category || addingIndex === idx}
                        className="flex items-center gap-1 text-xs font-bold bg-navy-600 text-white px-3 py-1.5 rounded-md disabled:opacity-40"
                      >
                        {addingIndex === idx ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} اعتماد وإضافة
                      </button>
                      <span className="flex items-center gap-1 text-xs text-ink-soft"><X size={12} /> أو تجاهل ببساطة</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
