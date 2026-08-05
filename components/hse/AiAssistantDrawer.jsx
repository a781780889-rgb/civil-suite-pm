'use client';
import { useState } from 'react';
import { Sparkles, X, Loader2, AlertTriangle } from 'lucide-react';
import * as hseApi from '@/lib/hseApi.js';

const ACTIONS = [
  { key: 'analyze', label: 'اكتشاف الأنماط والمناطق الأعلى خطورة', run: (pid) => hseApi.analyzeSafetyPatterns(pid) },
  { key: 'improvement-plan', label: 'تقييم الأداء وخطة التحسين', run: (pid) => hseApi.generateImprovementPlan(pid) },
  { key: 'summarize', label: 'ملخص تنفيذي لوضع السلامة', run: (pid) => hseApi.summarizeSafetyReport(pid) },
];

export default function AiAssistantDrawer({ projectId, open, onClose }) {
  const [loadingKey, setLoadingKey] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function runAction(action) {
    setLoadingKey(action.key); setError(null); setResult(null);
    try {
      const res = await action.run(projectId);
      setResult({ key: action.key, label: action.label, data: res });
    } catch (err) {
      setError(err.code === 'AI_NOT_CONFIGURED' ? 'ميزات الذكاء الاصطناعي تتطلب ضبط ANTHROPIC_API_KEY من مدير النظام أولاً.' : err.message);
    } finally {
      setLoadingKey(null);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-y-auto bg-white shadow-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2 text-navy-700"><Sparkles size={18} /><h2 className="font-semibold">مساعد السلامة الذكي</h2></div>
          <button onClick={onClose} className="rounded p-1 text-ink-soft hover:bg-paper"><X size={18} /></button>
        </div>

        <div className="space-y-2 p-4">
          {ACTIONS.map((action) => (
            <button
              key={action.key} onClick={() => runAction(action)} disabled={loadingKey !== null}
              className="flex w-full items-center justify-between rounded-sheet border border-line bg-paper px-3 py-2.5 text-right text-sm font-medium text-ink hover:border-navy-300 disabled:opacity-50"
            >
              {action.label}
              {loadingKey === action.key && <Loader2 size={15} className="animate-spin text-navy-600" />}
            </button>
          ))}
        </div>

        {error && (
          <div className="mx-4 flex items-start gap-2 rounded-sheet border border-fail-200 bg-fail-50 p-3 text-sm text-fail-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-3 p-4">
            <h3 className="text-sm font-semibold text-navy-700">{result.label}</h3>
            <AiResultView data={result.data} />
            <p className="rounded-sheet bg-paper p-2 text-xs text-ink-soft">{result.data.disclaimer}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AiResultView({ data }) {
  return (
    <div className="space-y-3 text-sm text-ink">
      {Object.entries(data).map(([key, value]) => {
        if (['disclaimer', 'reasoning', 'based_on'].includes(key)) return null;
        return (
          <div key={key}>
            {Array.isArray(value) ? (
              <ul className="list-inside list-disc space-y-1">
                {value.map((item, i) => (
                  <li key={i} className="text-ink-soft">
                    {typeof item === 'string' ? item : Object.values(item).filter(Boolean).join(' — ')}
                  </li>
                ))}
              </ul>
            ) : (
              typeof value === 'string' && <p className="text-ink-soft">{value}</p>
            )}
          </div>
        );
      })}
      {data.reasoning && <p className="border-t border-line pt-2 text-xs italic text-ink-soft">{data.reasoning}</p>}
    </div>
  );
}
