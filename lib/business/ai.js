// lib/business/ai.js
// =============================================================================
// الذكاء الاصطناعي (البند 20) - نفس نمط lib/pm/ai.js تماماً وبنفس القيد الصارم: "لا يُسمح له
// باتخاذ قرارات مالية أو تعاقدية بشكل مستقل. يجب أن تكون كل توصية قابلة للمراجعة من المستخدم"
// - كل دالة هنا تُعيد JSON مُقترَح للعرض فقط، ولا تكتب أي شيء في قاعدة البيانات بنفسها؛ الكتابة
// الفعلية (مثلاً اعتماد عقد) تمر دائماً عبر مسارات db/* وWorkflow الاعتماد في lib/business/db/approvals.js.
// =============================================================================
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-5';

export class BizAiError extends Error {
  constructor(message, code, rawResponse) {
    super(message);
    this.name = 'BizAiError';
    this.code = code;
    this.rawResponse = rawResponse;
  }
}

const GROUNDING_RULE =
  'التزم حصراً بالبيانات المُرسلة إليك أدناه بصيغة JSON. لا تخترع أرقاماً أو أسماء أو حقائق غير موجودة فيها. ' +
  'إن كانت البيانات غير كافية لإجابة واثقة، اذكر ذلك صراحة في الحقل المخصص لذلك بدل التخمين. ' +
  'أنت أداة تحليل مساعدة فقط - لا تصدر قراراً نهائياً بالاعتماد أو الرفض؛ كل مخرجاتك اقتراحات قابلة للمراجعة من مستخدم بشري صاحب صلاحية فعلية.';

async function callClaudeJson(systemPrompt, userPayload, { maxTokens = 1500 } = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new BizAiError('لم يتم تفعيل مساعد الذكاء الاصطناعي - يلزم ضبط ANTHROPIC_API_KEY في متغيرات البيئة.', 'AI_NOT_CONFIGURED');
  }
  let response;
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system: `${systemPrompt}\n\n${GROUNDING_RULE}\n\nأجب بصيغة JSON صِرف فقط، بلا أي نص تمهيدي ولا Markdown fences.`,
        messages: [{ role: 'user', content: JSON.stringify(userPayload) }],
      }),
    });
  } catch {
    throw new BizAiError('تعذّر الاتصال بخدمة الذكاء الاصطناعي.', 'AI_REQUEST_FAILED');
  }
  if (!response.ok) {
    let detail = '';
    try { detail = (await response.json())?.error?.message || ''; } catch { /* تجاهل */ }
    throw new BizAiError(`فشل طلب الذكاء الاصطناعي (${response.status})${detail ? ': ' + detail : ''}.`, 'AI_REQUEST_FAILED');
  }
  const data = await response.json();
  const text = (data.content || []).find((b) => b.type === 'text')?.text || '';
  const cleaned = text.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new BizAiError('رد الذكاء الاصطناعي لم يكن بصيغة JSON صالحة.', 'AI_INVALID_RESPONSE', text);
  }
}

export function isBusinessAiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function checkBusinessAiHealth() {
  return { configured: isBusinessAiConfigured(), model: MODEL };
}

/** تحليل فرصة تجارية + توقع احتمالية الفوز - من بيانات الفرصة وفرص فائزة/خاسرة سابقة لنفس العميل أو مشابهة. */
export async function analyzeOpportunity({ opportunity, client, historicalOpportunities }) {
  const system = 'أنت محلل فرص أعمال لشركة مقاولات ومكتب هندسي. قيّم فرصة تجارية واحدة بناءً على بياناتها وسجل فرص سابقة فعلي.';
  const schema = { winProbabilityEstimatePct: 0, reasoning: '', keyRisks: [''], recommendedActions: [''], confidence: 'low|medium|high' };
  return callClaudeJson(`${system} أعد النتيجة بالضبط بالمفاتيح التالية (JSON): ${JSON.stringify(schema)}`, { opportunity, client, historicalOpportunities });
}

/** تحليل أداء عميل عبر تاريخه الفعلي (فرص/عروض/عقود/دفعات). */
export async function analyzeClientPerformance({ client, opportunities, quotes, contracts, payments }) {
  const system = 'أنت محلل علاقات عملاء لشركة مقاولات. حلّل نمط تعامل عميل واحد بناءً على سجله الفعلي فقط.';
  const schema = { summary: '', strengths: [''], concerns: [''], paymentReliability: 'low|medium|high|unknown', recommendedActions: [''] };
  return callClaudeJson(`${system} أعد JSON بالمفاتيح: ${JSON.stringify(schema)}`, { client, opportunities, quotes, contracts, payments });
}

/** مقارنة عروض عدة موردين لنفس المادة/الخدمة (البند السابع + العشرون). */
export async function compareSupplierQuotes({ material, quotesFromSuppliers }) {
  const system = 'أنت محلل مشتريات هندسية. قارن عروض موردين متعددين لنفس المادة أو الخدمة بشكل موضوعي بناءً على السعر ومدة التوريد والتقييم التاريخي فقط.';
  const schema = { ranking: [{ supplierName: '', score: 0, notes: '' }], recommendedSupplier: '', reasoning: '' };
  return callClaudeJson(`${system} أعد JSON بالمفاتيح: ${JSON.stringify(schema)}`, { material, quotesFromSuppliers });
}

/** تحليل أداء شريك (مقاول أو مورد) بناءً على تقييماته الفعلية وأوامر العمل المرتبطة به. */
export async function analyzePartnerPerformance({ partner, evaluations, workOrders }) {
  const system = 'أنت محلل أداء موردين/مقاولين لشركة مقاولات. حلّل أداء شريك واحد بناءً على تقييماته الفعلية وسجل أوامر عمله فقط.';
  const schema = { overallAssessment: '', trend: 'improving|stable|declining|unknown', strengths: [''], concerns: [''], recommendedActions: [''] };
  return callClaudeJson(`${system} أعد JSON بالمفاتيح: ${JSON.stringify(schema)}`, { partner, evaluations, workOrders });
}

/** اكتشاف مصروفات/أسعار غير معتادة ضمن مجموعة بنود مالية فعلية (مستخلصات/بنود عروض أسعار). */
export async function detectAnomalies({ label, items }) {
  const system = 'أنت مدقّق مالي داخلي. افحص قائمة بنود مالية فعلية وحدّد أي بند يبدو غير معتاد بوضوح (قيمة شاذة إحصائياً أو نمط غريب) - لا تفترض غشاً، فقط أشِر لما يستحق مراجعة بشرية.';
  const schema = { flaggedItems: [{ reference: '', reason: '', severity: 'low|medium|high' }], overallAssessment: '' };
  return callClaudeJson(`${system} أعد JSON بالمفاتيح: ${JSON.stringify(schema)}`, { label, items });
}

/** تحليل عقد شامل (البند العشرون: "تحليل العقود"). */
export async function analyzeContract({ contract, changeOrders, payments }) {
  const system = 'أنت مستشار عقود لمكتب هندسي/شركة مقاولات. حلّل عقداً واحداً وحالته المالية والزمنية بناءً على بياناته الفعلية وأوامر التغيير والمستخلصات المرتبطة به فقط.';
  const schema = { financialHealthSummary: '', scheduleRisk: 'low|medium|high|unknown', notableChangeOrders: [''], recommendedActions: [''] };
  return callClaudeJson(`${system} أعد JSON بالمفاتيح: ${JSON.stringify(schema)}`, { contract, changeOrders, payments });
}

/** تلخيص مجموعة مراسلات (البند العشرون: "تلخيص المراسلات"). */
export async function summarizeCorrespondence({ correspondenceList }) {
  const system = 'أنت مساعد إداري. لخّص مجموعة مراسلات فعلية (صادر/وارد) في نقاط واضحة تُبرز أي بند يحتاج رد أو متابعة.';
  const schema = { summaryPoints: [''], itemsNeedingReply: [''], overallTone: '' };
  return callClaudeJson(`${system} أعد JSON بالمفاتيح: ${JSON.stringify(schema)}`, { correspondenceList });
}

/** استخراج التزامات محتملة من نص مستند (خطاب/عقد) - البند العشرون: "استخراج الالتزامات من المستندات". */
export async function extractCommitmentsFromText({ documentText, sourceLabel }) {
  const system = 'أنت مساعد قانوني/إداري. اقرأ نص مستند فعلي واستخرج منه أي التزامات أو مواعيد استحقاق واضحة مذكورة صراحة في النص فقط - لا تخترع التزامات غير مذكورة.';
  const schema = { extractedCommitments: [{ title: '', dueDateIfMentioned: '', responsiblePartyIfMentioned: '' }], notes: '' };
  return callClaudeJson(`${system} أعد JSON بالمفاتيح: ${JSON.stringify(schema)}`, { sourceLabel, documentText: String(documentText || '').slice(0, 12000) });
}

/** ملخص تنفيذي للإدارة من مؤشرات الأداء الحية (البند العشرون + البند 19: "التقرير التنفيذي"). */
export async function generateExecutiveSummary({ dashboardStats }) {
  const system = 'أنت مساعد تنفيذي لشركة مقاولات ومكتب هندسي. لخّص وضع الأعمال الحالي للإدارة العليا في نقاط موجزة وواضحة بناءً على مؤشرات الأداء الفعلية فقط.';
  const schema = { headline: '', highlights: [''], risksToWatch: [''], suggestedFocusAreas: [''] };
  return callClaudeJson(`${system} أعد JSON بالمفاتيح: ${JSON.stringify(schema)}`, { dashboardStats });
}

/** إجابة حرة على استفسار إداري عام بالاستناد إلى سياق مُرفَق فقط. */
export async function askBusinessAssistant({ question, context }) {
  const system = 'أنت مساعد إدارة أعمال هندسية. أجب عن سؤال المستخدم بالاستناد فقط إلى السياق المُرفَق أدناه من بيانات النظام الفعلية.';
  const schema = { answer: '', supportingDataPoints: [''], caveats: [''] };
  return callClaudeJson(`${system} أعد JSON بالمفاتيح: ${JSON.stringify(schema)}`, { question, context });
}
