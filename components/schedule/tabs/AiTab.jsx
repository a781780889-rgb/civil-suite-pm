'use client';
import { useState } from 'react';
import { Sparkles, Send, AlertCircle } from 'lucide-react';
import { schAi } from '@/lib/scheduleApi.js';
import { Section, EmptyState } from '@/components/pm/Shared.jsx';

export default function AiTab({ schedule }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [asking, setAsking] = useState(false);

  async function runAnalysis() {
    setLoading(true);
    setError('');
    const res = await schAi.analyze(schedule.id);
    setLoading(false);
    if (!res.success) { setError(res.error); return; }
    setAnalysis(res.analysis);
  }

  async function ask() {
    if (!question.trim()) return;
    setAsking(true);
    const res = await schAi.ask(schedule.id, question);
    setAsking(false);
    if (res.success) setAnswer(res);
    else setError(res.error);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-sheet border border-line bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-rebar-600" />
            <h3 className="font-bold text-navy-700 text-sm">تحليل ذكي شامل للجدول</h3>
          </div>
          <button onClick={runAnalysis} disabled={loading} className="rounded-md bg-navy-600 hover:bg-navy-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 transition-colors">
            {loading ? 'جارِ التحليل…' : 'تشغيل التحليل'}
          </button>
        </div>
        <p className="text-xs text-ink-soft mt-1.5">توصيات استشارية مبنية على بيانات الجدول الفعلية فقط - لا تُنفَّذ تلقائياً، تحتاج مراجعتك واعتمادك.</p>
      </div>

      {error && <p className="text-xs text-fail-700 flex items-center gap-1.5"><AlertCircle size={13} /> {error}</p>}

      {analysis && (
        <div className="grid md:grid-cols-2 gap-4">
          <Section title="التقييم العام"><p className="text-sm text-ink leading-relaxed">{analysis.overallAssessment}</p></Section>
          <Section title="توقّع التأخير">
            <p className="text-sm text-ink">{analysis.delayForecast?.summary}</p>
            <p className="text-xs text-ink-soft mt-1">{analysis.delayForecast?.reasoning}</p>
          </Section>
          <Section title="الاختناقات">
            {(analysis.bottlenecks || []).length === 0 ? <EmptyState title="لا اختناقات مكتشَفة" /> : (
              <ul className="space-y-2">{analysis.bottlenecks.map((b, i) => <li key={i} className="text-sm"><span className="font-bold text-ink">{b.activity}:</span> {b.issue}<p className="text-xs text-ink-soft">{b.reasoning}</p></li>)}</ul>
            )}
          </Section>
          <Section title="اقتراحات إعادة الجدولة">
            {(analysis.resequencingSuggestions || []).length === 0 ? <EmptyState title="لا اقتراحات حالياً" /> : (
              <ul className="space-y-2">{analysis.resequencingSuggestions.map((s, i) => <li key={i} className="text-sm">{s.suggestion}<p className="text-xs text-ink-soft">{s.expectedImpact}</p></li>)}</ul>
            )}
          </Section>
          <Section title="تحسين توزيع الموارد">
            {(analysis.resourceOptimization || []).length === 0 ? <EmptyState title="لا اقتراحات حالياً" /> : (
              <ul className="space-y-2 text-sm">{analysis.resourceOptimization.map((s, i) => <li key={i}>{s.suggestion}</li>)}</ul>
            )}
          </Section>
          <Section title="التوصيات">
            {(analysis.recommendations || []).length === 0 ? <EmptyState title="لا توصيات حالياً" /> : (
              <ul className="space-y-2">{analysis.recommendations.map((r, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <span className={`shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full ${r.priority === 'high' ? 'bg-fail-DEFAULT' : r.priority === 'medium' ? 'bg-warnclr-DEFAULT' : 'bg-concrete-400'}`} />
                  <span>{r.action}<p className="text-xs text-ink-soft">{r.reasoning}</p></span>
                </li>
              ))}</ul>
            )}
          </Section>
        </div>
      )}

      <Section title="اسأل المساعد عن الجدول">
        <div className="flex gap-2">
          <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="مثال: ما الأنشطة الأكثر عرضة للتأخير هذا الشهر؟" className="flex-1 rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300" />
          <button onClick={ask} disabled={asking} className="shrink-0 rounded-md bg-navy-600 hover:bg-navy-700 disabled:opacity-60 text-white p-2.5"><Send size={15} /></button>
        </div>
        {answer && (
          <div className="mt-3 text-sm text-ink bg-paper rounded-md p-3">
            <p>{answer.answer}</p>
            {answer.insufficientData && <p className="text-xs text-warnclr-DEFAULT mt-1">بيانات غير كافية للإجابة بدقة كاملة.</p>}
          </div>
        )}
      </Section>
    </div>
  );
}
