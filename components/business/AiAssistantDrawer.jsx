'use client';
import { useState } from 'react';
import { X, Sparkles, Send, Loader2, AlertTriangle } from 'lucide-react';
import { callBusinessAi } from '@/lib/businessApi.js';

/** يُستخدم بصيغتين: مضمّن في صفحة كيان (quickActions محدّدة بسياقها)، أو مستقل من /dashboard/business/ai (بلا quickActions - سؤال حر فقط). */
export default function AiAssistantDrawer({ open, onClose, context, quickActions = [] }) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [resultLabel, setResultLabel] = useState('');

  async function run(action, payload, label) {
    setLoading(true); setError(null); setResult(null); setResultLabel(label);
    try {
      const res = await callBusinessAi(action, payload);
      setResult(res.result);
    } catch (err) {
      setError(err.data?.code === 'AI_NOT_CONFIGURED'
        ? 'مساعد الذكاء الاصطناعي غير مُفعَّل حالياً على هذا الخادم (يلزم ضبط ANTHROPIC_API_KEY).'
        : err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleAsk(e) {
    e.preventDefault();
    if (!question.trim()) return;
    run('ask', { question, context }, `سؤال: ${question}`);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-navy-900/40" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-sheet border-r border-line flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-navy" />
            <span className="font-bold text-ink text-sm">مساعد إدارة الأعمال الذكي</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-line text-ink-soft"><X size={18} /></button>
        </div>

        {quickActions.length > 0 && (
          <div className="px-4 py-3 border-b border-line shrink-0 flex flex-wrap gap-2">
            {quickActions.map((qa) => (
              <button
                key={qa.label}
                onClick={() => run(qa.action, qa.payload, qa.label)}
                disabled={loading}
                className="text-xs font-medium px-3 py-1.5 rounded-full bg-navy/10 text-navy hover:bg-navy/20 transition-colors disabled:opacity-50"
              >
                {qa.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          <p className="text-[11px] text-ink-soft leading-relaxed bg-line/40 rounded-md px-3 py-2">
            كل ما يعرضه المساعد اقتراحات للمراجعة البشرية فقط، ولا يتخذ أي قرار مالي أو تعاقدي، ولا يعدّل أي بيانات مباشرة.
          </p>
          {loading && (
            <div className="flex items-center gap-2 text-sm text-ink-soft"><Loader2 size={16} className="animate-spin" /> جارٍ التحليل...</div>
          )}
          {error && (
            <div className="flex items-start gap-2 text-sm text-fail bg-fail/10 rounded-md px-3 py-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" /><span>{error}</span>
            </div>
          )}
          {result && (
            <div className="space-y-2">
              {resultLabel && <div className="text-xs font-bold text-ink-soft">{resultLabel}</div>}
              <ResultRenderer data={result} />
            </div>
          )}
        </div>

        <form onSubmit={handleAsk} className="p-3 border-t border-line shrink-0 flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="اسأل عن أي شيء في بيانات الأعمال..."
            className="flex-1 rounded-md border border-line px-3 py-2 text-sm bg-paper focus:outline-none focus:ring-2 focus:ring-navy/30"
          />
          <button type="submit" disabled={loading} className="rounded-md bg-navy text-white px-3 py-2 disabled:opacity-50">
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}

/** يعرض أي كائن JSON مُعاد من الذكاء الاصطناعي بشكل مقروء بلا افتراض شكل ثابت لكل الحقول. */
function ResultRenderer({ data }) {
  if (typeof data !== 'object' || data === null) return <p className="text-sm text-ink">{String(data)}</p>;
  return (
    <div className="space-y-2.5">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="text-sm">
          <div className="text-[11px] font-bold text-ink-soft mb-0.5">{key}</div>
          {Array.isArray(value) ? (
            value.length === 0 ? <div className="text-ink-soft text-xs">—</div> : (
              <ul className="list-disc pr-4 space-y-1">
                {value.map((v, i) => <li key={i} className="text-ink">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</li>)}
              </ul>
            )
          ) : typeof value === 'object' && value !== null ? (
            <ResultRenderer data={value} />
          ) : (
            <div className="text-ink">{String(value)}</div>
          )}
        </div>
      ))}
    </div>
  );
}
