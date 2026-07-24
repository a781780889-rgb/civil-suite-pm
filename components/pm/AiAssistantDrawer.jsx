'use client';
// components/pm/AiAssistantDrawer.jsx — واجهة مساعد الذكاء الاصطناعي (lib/pm/ai.js). كل نتيجة
// تُعرض كاقتراح يحتاج مراجعة المستخدم (لا يُكتب شيء تلقائياً في قاعدة البيانات).

import { useState } from 'react';
import { Sparkles, X, Loader2, Send } from 'lucide-react';
import { pmAi } from '@/lib/pmApi.js';

export default function AiAssistantDrawer({ projectId }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('health');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [health, setHealth] = useState(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);

  async function runHealth() {
    setLoading(true); setError(''); setHealth(null);
    const res = await pmAi.health(projectId);
    setLoading(false);
    if (res.success) setHealth(res.analysis);
    else setError(res.error || 'تعذّر تحليل المشروع.');
  }

  async function runAsk() {
    if (!question.trim()) return;
    setLoading(true); setError(''); setAnswer(null);
    const res = await pmAi.ask(projectId, question.trim());
    setLoading(false);
    if (res.success) setAnswer(res.answer);
    else setError(res.error || 'تعذّر الحصول على إجابة.');
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 left-5 z-30 flex items-center gap-2 rounded-full bg-navy-700 text-white px-4 py-3 shadow-sheet hover:bg-navy-800 transition-colors"
      >
        <Sparkles size={16} />
        <span className="text-sm font-medium">المساعد الذكي</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center sm:justify-start bg-ink/30" onClick={() => setOpen(false)}>
          <div className="w-full sm:w-[420px] sm:m-5 max-h-[85vh] rounded-t-sheet sm:rounded-sheet bg-white border border-line shadow-sheet flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-line">
              <div className="flex items-center gap-2 text-navy-700 font-bold text-sm"><Sparkles size={16} /> المساعد الذكي للمشروع</div>
              <button onClick={() => setOpen(false)}><X size={18} className="text-ink-soft" /></button>
            </div>
            <div className="flex border-b border-line text-xs">
              <button onClick={() => setTab('health')} className={`flex-1 py-2 font-medium ${tab === 'health' ? 'text-navy-700 border-b-2 border-navy-600' : 'text-ink-soft'}`}>تحليل صحة المشروع</button>
              <button onClick={() => setTab('ask')} className={`flex-1 py-2 font-medium ${tab === 'ask' ? 'text-navy-700 border-b-2 border-navy-600' : 'text-ink-soft'}`}>اسأل عن المشروع</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
              {error && <div className="rounded-md bg-fail-50 border border-fail-100 text-fail-700 text-xs p-2.5">{error}</div>}

              {tab === 'health' && (
                <>
                  <button onClick={runHealth} disabled={loading} className="w-full rounded-md bg-navy-600 text-white py-2 text-sm font-medium hover:bg-navy-700 disabled:opacity-60 flex items-center justify-center gap-2">
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} تحليل الآن
                  </button>
                  {health && (
                    <div className="space-y-3">
                      <p className="text-ink">{health.overallAssessment}</p>
                      {health.progressAnalysis && (
                        <div className="rounded-md bg-paper p-2.5">
                          <p className="font-medium text-xs text-navy-700 mb-1">تحليل التقدم</p>
                          <p className="text-xs text-ink-soft">{health.progressAnalysis.summary}</p>
                        </div>
                      )}
                      {health.delayAnalysis?.length > 0 && (
                        <div>
                          <p className="font-medium text-xs text-navy-700 mb-1">أسباب التأخير المحتملة</p>
                          <ul className="space-y-1.5">
                            {health.delayAnalysis.map((d, i) => (
                              <li key={i} className="text-xs text-ink-soft rounded-md bg-fail-50 p-2 border border-fail-100">
                                <span className="font-medium text-fail-700">{d.item}</span> — {d.possibleCause}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {health.suggestedActions?.length > 0 && (
                        <div>
                          <p className="font-medium text-xs text-navy-700 mb-1">إجراءات مقترحة (تحتاج مراجعتك)</p>
                          <ul className="space-y-1.5">
                            {health.suggestedActions.map((a, i) => (
                              <li key={i} className="text-xs rounded-md bg-navy-50 p-2 border border-navy-100">
                                <span className="font-medium text-navy-700">{a.action}</span>
                                <p className="text-ink-soft mt-0.5">{a.reasoning}</p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {tab === 'ask' && (
                <>
                  <div className="flex gap-2">
                    <input
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && runAsk()}
                      placeholder="مثال: ما أكبر المخاطر المفتوحة حالياً؟"
                      className="flex-1 rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300"
                    />
                    <button onClick={runAsk} disabled={loading} className="rounded-md bg-navy-600 text-white px-3 disabled:opacity-60">
                      {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    </button>
                  </div>
                  {answer && (
                    <div className="rounded-md bg-paper p-3 space-y-2">
                      <p className="text-ink">{answer.answer}</p>
                      {answer.basedOn?.length > 0 && (
                        <p className="text-[11px] text-ink-soft">استند إلى: {answer.basedOn.join('، ')}</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
