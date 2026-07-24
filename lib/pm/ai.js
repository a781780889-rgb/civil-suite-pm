// lib/pm/ai.js
// =============================================================================
// مساعد الذكاء الاصطناعي لإدارة المشاريع - يلتزم حرفياً بالبند الثالث عشر من القواعد
// الإلزامية لهذا القسم:
//   "لا يعتمد أي قرار نهائي بدون موافقة المستخدم" / "يجب توضيح سبب كل توصية" /
//   "استخدام البيانات الفعلية فقط" / "عدم إنشاء معلومات غير موجودة" / "تقديم تحليلات
//   قابلة للمراجعة"
// لذلك: كل دالة هنا (1) تستقبل بيانات المشروع الفعلية من قاعدة البيانات كسياق فقط،
// (2) لا تكتب أي شيء في قاعدة البيانات بنفسها - النتيجة تُعرض للمستخدم في الواجهة ليقرر
// حفظها أو تجاهلها، (3) تُلزَم صراحة في التوجيه (system prompt) بعدم اختراع أرقام أو وقائع
// غير موجودة في السياق المُرسَل، (4) تُرفق أساس/سبب نصياً مع كل استنتاج.
// نفس نمط lib/boq/ai.js تماماً: يتطلب ANTHROPIC_API_KEY في بيئة الخادم؛ بدونه يُعيد خطأ
// واضحاً بدل الفشل الصامت أو تلفيق نتيجة.
// =============================================================================

const DEFAULT_MODEL = process.env.PM_AI_MODEL || process.env.BOQ_AI_MODEL || 'claude-sonnet-5';

const BASE_RULES = `قواعد صارمة يجب الالتزام بها دون استثناء:
- استخدم فقط البيانات المرسلة إليك في هذه الرسالة. لا تخترع أرقاماً أو تواريخ أو أسماء غير
  موجودة في السياق المُرسَل. إن كانت معلومة ما غير كافية للاستنتاج، صرّح بذلك بدل التخمين.
- كل استنتاج أو توصية يجب أن يحمل "reasoning" نصياً يوضح أساسه من البيانات المرسلة تحديداً.
- أنت مساعد استشاري فقط - لا تصدر قراراً نهائياً؛ صِغ كل توصية كاقتراح يحتاج مراجعة المستخدم.
- أعد JSON صرفاً فقط، بلا أي نص أو Markdown خارج بنية الـ JSON المطلوبة.`;

async function callClaudeJson({ system, userText, maxTokens = 2000 }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err = new Error('مساعد الذكاء الاصطناعي غير مُفعّل: يلزم ضبط متغير البيئة ANTHROPIC_API_KEY في إعدادات الخادم أولاً.');
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userText }],
    }),
  });
  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    const err = new Error(`فشل استدعاء واجهة الذكاء الاصطناعي (${response.status}). ${bodyText.slice(0, 300)}`);
    err.code = 'AI_REQUEST_FAILED';
    throw err;
  }
  const data = await response.json();
  const rawText = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const err = new Error('تعذّر تفسير استجابة الذكاء الاصطناعي كـ JSON صالح.');
    err.code = 'AI_INVALID_RESPONSE';
    err.rawResponse = rawText.slice(0, 1500);
    throw err;
  }
}

/** تحليل صحة المشروع: تقدم، تأخير، أسباب، حلول مقترحة، خطط بديلة - كل ذلك من بيانات فعلية فقط. */
export async function analyzeProjectHealth({ project, phases, tasks, delayedTasks, budgetSummary, risks }) {
  const system = `أنت مساعد تحليل مشاريع هندسية (إنشاءات). حلّل صحة المشروع المرسل بياناته وأعد JSON بهذا الشكل فقط:
{"overallAssessment": "...", "progressAnalysis": {"summary": "...", "reasoning": "..."},
 "delayAnalysis": [{"item": "...", "possibleCause": "...", "reasoning": "..."}],
 "suggestedActions": [{"action": "...", "reasoning": "...", "priority": "high|medium|low"}],
 "alternativePlans": [{"plan": "...", "tradeoff": "..."}]}
إن لم تكن هناك مهام متأخرة، أعد delayAnalysis كمصفوفة فارغة، ولا تخترع تأخيراً غير موجود في البيانات.
${BASE_RULES}`;
  const userText = JSON.stringify({
    project: { name: project.name, status: project.status, start_date: project.start_date, end_date: project.end_date },
    phasesCount: phases.length,
    phasesSummary: phases.map((p) => ({ name: p.name, status: p.status, progress_pct: p.progress_pct })),
    tasksTotal: tasks.length,
    delayedTasks: delayedTasks.map((t) => ({ title: t.title, planned_end: t.planned_end, delayDays: t.delayDays, status: t.status })),
    budgetSummary,
    openRisks: risks.filter((r) => r.status === 'open').map((r) => ({ title: r.title, probability: r.probability, impact: r.impact })),
  });
  return callClaudeJson({ system, userText, maxTokens: 3000 });
}

/** يلخّص اجتماعاً من محضره الفعلي (agenda/minutes/القرارات) فقط - لا يضيف قرارات غير مذكورة. */
export async function summarizeMeeting({ meeting, decisions }) {
  const system = `لخّص محضر الاجتماع المرسل بإيجاز احترافي. أعد JSON فقط بهذا الشكل:
{"summary": "...", "keyPoints": ["..."], "openDecisions": ["..."], "reasoning": "أساس التلخيص من النص المرسل"}
لا تُضِف أي قرار أو نقطة غير واردة فعلياً في النص المُرسَل.
${BASE_RULES}`;
  const userText = JSON.stringify({
    title: meeting.title, date: meeting.meeting_date, agenda: meeting.agenda || '', minutes: meeting.minutes || '',
    decisions: (decisions || []).map((d) => ({ text: d.decision_text, responsible: d.responsible, status: d.status })),
  });
  return callClaudeJson({ system, userText, maxTokens: 1500 });
}

/** إجابة عن استفسار حر عن المشروع، مبنية فقط على شريحة البيانات المُرسَلة معه. */
export async function askProjectAssistant({ project, contextData, question }) {
  const system = `أنت مساعد استفسارات مشروع هندسي. أجب عن سؤال المستخدم بالاعتماد حصراً على البيانات
المرسلة أدناه. أعد JSON فقط: {"answer": "...", "basedOn": ["وصف مختصر لكل جزء بيانات استُخدم"],
"insufficientData": false}. إن كانت البيانات المرسلة غير كافية للإجابة بدقة، اجعل insufficientData
تساوي true واشرح في answer ما هي المعلومة الناقصة.
${BASE_RULES}`;
  const userText = JSON.stringify({ project: { name: project.name, status: project.status }, contextData, question });
  return callClaudeJson({ system, userText, maxTokens: 2000 });
}

/** فقرة سردية تنفيذية تُرفَق فوق تقرير محسوب فعلياً (لا تُنشئ الأرقام، تُفسّرها فقط). */
export async function generateReportNarrative({ reportType, data }) {
  const system = `اكتب فقرة تنفيذية موجزة (٤-٦ جمل) تُلخّص بيانات تقرير مشروع هندسي مُرسَلة إليك فعلياً،
دون اختراع أي رقم غير موجود فيها. أعد JSON فقط: {"narrative": "...", "reasoning": "أساس الفقرة من الأرقام المرسلة"}.
${BASE_RULES}`;
  const userText = JSON.stringify({ reportType, data });
  return callClaudeJson({ system, userText, maxTokens: 1200 });
}
