// lib/schedule/ai.js
// =============================================================================
// المساعد الذكي لنظام الجدول الزمني - يلتزم حرفياً بالبند الثاني عشر من القواعد
// الإلزامية: تحليل الجدول، التنبؤ بالتأخير، اكتشاف الاختناقات، اقتراح إعادة الجدولة،
// تحسين توزيع الموارد، تقديم توصيات موضَّحة السبب "دون تنفيذ أي تعديل تلقائياً إلا بعد
// موافقة المستخدم" - لذلك هذه الدوال قراءة فقط: تستقبل بيانات فعلية محسوبة من المحرك
// الحقيقي (lib/schedule/criticalPath.js) ولا تكتب في قاعدة البيانات بنفسها إطلاقاً.
// نفس نمط lib/pm/ai.js حرفياً لتوحيد سلوك المساعد الذكي عبر المنصة.
// =============================================================================

const DEFAULT_MODEL = process.env.SCHEDULE_AI_MODEL || process.env.PM_AI_MODEL || 'claude-sonnet-5';

const BASE_RULES = `قواعد صارمة يجب الالتزام بها دون استثناء:
- استخدم فقط البيانات المرسلة إليك في هذه الرسالة. لا تخترع أنشطة أو تواريخ أو أرقاماً غير
  موجودة في السياق المُرسَل. إن كانت معلومة ما غير كافية للاستنتاج، صرّح بذلك بدل التخمين.
- كل استنتاج أو توصية يجب أن يحمل "reasoning" نصياً يوضح أساسه من البيانات المرسلة تحديداً.
- أنت مساعد استشاري فقط - لا تُنفّذ أي تعديل ولا تصدر قراراً نهائياً؛ صِغ كل توصية كاقتراح
  يحتاج مراجعة مهندس التخطيط أو مدير المشروع والموافقة عليه يدوياً قبل أي تطبيق.
- أعد JSON صرفاً فقط، بلا أي نص أو Markdown خارج بنية الـ JSON المطلوبة.`;

async function callClaudeJson({ system, userText, maxTokens = 2200 }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err = new Error('مساعد الذكاء الاصطناعي غير مُفعّل: يلزم ضبط متغير البيئة ANTHROPIC_API_KEY في إعدادات الخادم أولاً.');
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: DEFAULT_MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content: userText }] }),
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

/**
 * تحليل شامل للجدول الزمني: تنبؤ بالتأخير، اكتشاف اختناقات، اقتراح إعادة جدولة،
 * تحسين توزيع الموارد، توصيات مسبَّبة - كل ذلك من بيانات محسوبة فعلياً من محرك CPM.
 */
export async function analyzeSchedule({ schedule, activities, delayedActivities, criticalActivities, resourceConflicts, projectEndDate, targetEndDate }) {
  const system = `أنت مساعد تخطيط وجدولة مشاريع إنشائية بخبرة Primavera P6. حلّل بيانات الجدول الزمني
المرسلة وأعد JSON بهذا الشكل فقط:
{"overallAssessment": "...",
 "delayForecast": {"summary": "...", "reasoning": "..."},
 "bottlenecks": [{"activity": "...", "issue": "...", "reasoning": "..."}],
 "resequencingSuggestions": [{"suggestion": "...", "expectedImpact": "...", "reasoning": "..."}],
 "resourceOptimization": [{"suggestion": "...", "reasoning": "..."}],
 "risks": [{"risk": "...", "likelihood": "high|medium|low", "reasoning": "..."}],
 "recommendations": [{"action": "...", "reasoning": "...", "priority": "high|medium|low"}]}
إن لم تتوفر بيانات كافية لأي بند، أعده كمصفوفة فارغة أو وضّح النقص داخل الحقل النصي - لا تخترع.
${BASE_RULES}`;
  const userText = JSON.stringify({
    schedule: { name: schedule.name, dataDate: schedule.data_date, projectEndDate, targetEndDate },
    activitiesCount: activities.length,
    criticalActivities: criticalActivities.map((a) => ({ name: a.name, wbs: a.wbs_code, plannedEnd: a.planned_end, totalFloat: a.total_float_days })),
    delayedActivities: delayedActivities.map((a) => ({ name: a.name, wbs: a.wbs_code, plannedEnd: a.planned_end, delayDays: a.delayDays, status: a.status })),
    resourceConflictsCount: (resourceConflicts || []).length,
    resourceConflicts: (resourceConflicts || []).slice(0, 15),
  });
  return callClaudeJson({ system, userText, maxTokens: 3200 });
}

/** إجابة عن استفسار حر عن الجدول الزمني، مبنية فقط على شريحة البيانات المُرسَلة معه. */
export async function askScheduleAssistant({ schedule, contextData, question }) {
  const system = `أنت مساعد استفسارات جدول زمني لمشروع إنشائي. أجب عن سؤال المستخدم بالاعتماد حصراً
على البيانات المرسلة أدناه. أعد JSON فقط: {"answer": "...", "basedOn": ["وصف مختصر لكل جزء بيانات استُخدم"],
"insufficientData": false}. إن كانت البيانات غير كافية للإجابة بدقة، اجعل insufficientData تساوي true
واشرح في answer ما هي المعلومة الناقصة.
${BASE_RULES}`;
  const userText = JSON.stringify({ schedule: { name: schedule.name }, contextData, question });
  return callClaudeJson({ system, userText, maxTokens: 2000 });
}

/** فقرة سردية تنفيذية تُرفَق فوق تقرير محسوب فعلياً (لا تُنشئ الأرقام، تُفسّرها فقط). */
export async function generateScheduleReportNarrative({ reportType, data }) {
  const system = `اكتب فقرة تنفيذية موجزة (٤-٦ جمل) تُلخّص بيانات تقرير جدول زمني مُرسَلة إليك فعلياً،
دون اختراع أي رقم غير موجود فيها. أعد JSON فقط: {"narrative": "...", "reasoning": "أساس الفقرة من الأرقام المرسلة"}.
${BASE_RULES}`;
  const userText = JSON.stringify({ reportType, data });
  return callClaudeJson({ system, userText, maxTokens: 1200 });
}
