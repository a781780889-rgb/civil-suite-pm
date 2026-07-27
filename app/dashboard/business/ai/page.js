'use client';
import { useEffect, useState } from 'react';
import { Sparkles, Send, Loader2, AlertTriangle } from 'lucide-react';
import { Section } from '@/components/pm/Shared.jsx';
import { getDashboardStats, getAiHealth, callBusinessAi } from '@/lib/businessApi.js';

export default function BusinessAiPage() {
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    getAiHealth().then(setHealth).catch(() => {});
    getDashboardStats().then((r) => setStats(r.stats)).catch(() => {});
  }, []);

  async function run(action, payload) {
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await callBusinessAi(action, payload);
      setResult(res.result);
    } catch (err) {
      setError(err.data?.code === 'AI_NOT_CONFIGURED' ? 'مساعد الذكاء الاصطناعي غير مُفعَّل حالياً (يلزم ضبط ANTHROPIC_API_KEY على الخادم).' : err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleAsk(e) {
    e.preventDefault();
    if (!question.trim()) return;
    run('ask', { question, context: { dashboardStats: stats } });
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-3xl">
      <div className="flex items-center gap-2">
        <Sparkles className="text-navy" size={22} />
        <div>
          <h1 className="text-xl font-bold text-ink">مساعد إدارة الأعمال الذكي</h1>
          <p className="text-sm text-ink-soft">{health ? (health.configured ? `مُفعَّل — نموذج ${health.model}` : 'غير مُفعَّل على هذا الخادم حالياً') : 'جارٍ التحقق...'}</p>
        </div>
      </div>

      <p className="text-xs text-ink-soft leading-relaxed bg-line/40 rounded-md px-3 py-2">
        كل ما يعرضه المساعد اقتراحات للمراجعة البشرية فقط، ولا يتخذ أي قرار مالي أو تعاقدي، ولا يعدّل أي بيانات مباشرة في النظام.
      </p>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => run('executive-summary', { dashboardStats: stats })} disabled={loading || !stats} className="text-sm font-medium px-3 py-2 rounded-md bg-navy/10 text-navy hover:bg-navy/20 disabled:opacity-50">إنشاء ملخص تنفيذي من المؤشرات الحية</button>
      </div>

      {loading && <div className="flex items-center gap-2 text-sm text-ink-soft"><Loader2 size={16} className="animate-spin" /> جارٍ التحليل...</div>}
      {error && <div className="flex items-start gap-2 text-sm text-fail bg-fail/10 rounded-md px-3 py-2"><AlertTriangle size={16} className="shrink-0 mt-0.5" /><span>{error}</span></div>}
      {result && (
        <Section title="النتيجة">
          <ResultRenderer data={result} />
        </Section>
      )}

      <form onSubmit={handleAsk} className="flex gap-2 sticky bottom-4">
        <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="اسأل عن أي شيء في بيانات الأعمال..." className="flex-1 rounded-md border border-line px-3 py-2.5 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-navy-300" />
        <button type="submit" disabled={loading} className="rounded-md bg-navy text-white px-4 py-2.5 disabled:opacity-50"><Send size={16} /></button>
      </form>
    </div>
  );
}

function ResultRenderer({ data }) {
  if (typeof data !== 'object' || data === null) return <p className="text-sm text-ink">{String(data)}</p>;
  return (
    <div className="space-y-2.5">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="text-sm">
          <div className="text-[11px] font-bold text-ink-soft mb-0.5">{key}</div>
          {Array.isArray(value) ? (
            value.length === 0 ? <div className="text-ink-soft text-xs">—</div> : (
              <ul className="list-disc pr-4 space-y-1">{value.map((v, i) => <li key={i} className="text-ink">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</li>)}</ul>
            )
          ) : typeof value === 'object' && value !== null ? <ResultRenderer data={value} /> : <div className="text-ink">{String(value)}</div>}
        </div>
      ))}
    </div>
  );
}
