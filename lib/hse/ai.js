// lib/hse/ai.js
// المساعد الذكي (البند 21). نفس نمط lib/equipment/ai.js تماماً: استدعاء حقيقي لـ Anthropic API
// (بلا مفتاح API لا تعمل هذه الدوال إطلاقاً - رسالة AI_NOT_CONFIGURED واضحة، وبقية القسم يعمل
// بشكل طبيعي تماماً بدونها) مبني بالكامل على بيانات حقيقية من hse_* عبر buildSafetyContext.
//
// قيد إلزامي صريح من البند 21 حرفياً: "لا يجوز له إصدار قرار سلامة نهائي أو اعتماد تصريح عمل
// أو إيقاف مشروع بشكل تلقائي" - لذلك لا توجد أي دالة هنا تكتب إلى قاعدة البيانات أو تستدعي
// decidePermit/closeIncident/approveAndCloseCorrectiveAction. كل دالة في هذا الملف للقراءة
// والتحليل فقط، وتعيد نصاً/JSON للعرض على مستخدم بشري يتخذ القرار الفعلي بنفسه.
//
// "إصدار تنبيهات استباقية عند ارتفاع مستوى المخاطر" (من قائمة قدرات الذكاء الاصطناعي في الوثيقة
// الأولى) مُنفَّذ فعلياً كقواعد حتمية في lib/hse/notificationsScan.js (عتبات صريحة: خطر حرج
// مفتوح، ارتفاع شهري في الحوادث...) بدل استدعاء نموذج لغوي في كل طلب - أكثر اتساقاً ويعمل حتى
// بلا ANTHROPIC_API_KEY؛ هذا الملف يكمّلها بتحليل نوعي عند الطلب فقط.
import { hdb } from './schema.js';

const AI_MODEL = process.env.HSE_AI_MODEL || 'claude-sonnet-5';

export async function checkHseAiHealth() {
  return { configured: Boolean(process.env.ANTHROPIC_API_KEY), model: AI_MODEL };
}

async function callClaude(systemPrompt, userPrompt, { maxTokens = 1800 } = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err = new Error('مفتاح واجهة الذكاء الاصطناعي غير مُعدّ. أضف ANTHROPIC_API_KEY في متغيرات البيئة (راجع .env.example).');
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }
  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: maxTokens, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] }),
    });
  } catch (e) {
    const err = new Error('تعذّر الاتصال بخدمة الذكاء الاصطناعي.');
    err.code = 'AI_REQUEST_FAILED';
    err.rawResponse = e.message;
    throw err;
  }
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`فشل طلب الذكاء الاصطناعي (${res.status}).`);
    err.code = 'AI_REQUEST_FAILED';
    err.rawResponse = text;
    throw err;
  }
  const data = await res.json();
  return (data.content || []).map((b) => b.text || '').join('\n').trim();
}

function parseJsonResponse(text) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  try { return JSON.parse(cleaned); }
  catch {
    const err = new Error('رد الذكاء الاصطناعي لم يكن بصيغة JSON صالحة.');
    err.code = 'AI_INVALID_RESPONSE';
    err.rawResponse = text;
    throw err;
  }
}

const SAFETY_DISCLAIMER = 'هذا تحليل استرشادي من الذكاء الاصطناعي بناءً على البيانات المسجَّلة فقط - لا يُغني عن تقييم مسؤول السلامة البشري ولا يمثّل قراراً نهائياً أو اعتماداً لأي تصريح أو إجراء.';

/** يبني سياقاً نصياً حقيقياً من بيانات القسم الثامن الفعلية - مشترك بين كل استدعاءات الذكاء الاصطناعي هنا. */
function buildSafetyContext(project_id) {
  const db = hdb();
  const projFilter = project_id ? ' AND project_id = @project_id' : '';
  const params = { project_id: project_id || null };

  const incidents = db.prepare(`SELECT incident_no, incident_type, incident_date, location, immediate_cause, root_cause, status FROM hse_incidents WHERE 1=1${projFilter} ORDER BY incident_date DESC LIMIT 30`).all(params);
  const nearMisses = db.prepare(`SELECT near_miss_no, description, location, cause, risk_level FROM hse_near_misses WHERE 1=1${projFilter} ORDER BY created_at DESC LIMIT 20`).all(params);
  const risks = db.prepare(`SELECT risk_no, title, category, location, risk_level, risk_score, status FROM hse_risks WHERE status != 'closed'${projFilter} ORDER BY risk_score DESC LIMIT 20`).all(params);
  const violations = db.prepare(`SELECT violation_no, violation_type, severity, location, status FROM hse_violations WHERE 1=1${projFilter} ORDER BY violation_date DESC LIMIT 20`).all(params);
  const inspections = db.prepare(`SELECT inspection_no, inspection_type, overall_result, inspection_date FROM hse_inspections WHERE 1=1${projFilter} ORDER BY inspection_date DESC LIMIT 20`).all(params);
  const overdueActions = db.prepare(`SELECT action_no, description, status, due_date FROM hse_corrective_actions WHERE status NOT IN ('closed','verified') AND due_date < date('now')${projFilter}`).all(params);

  const text = `
الحوادث المسجَّلة (${incidents.length} من آخر 30):
${incidents.map((i) => `- ${i.incident_no} | ${i.incident_type} | ${i.incident_date} | ${i.location || 'غير محدد'} | سبب مباشر: ${i.immediate_cause || '-'} | سبب جذري: ${i.root_cause || '-'} | حالة: ${i.status}`).join('\n') || 'لا توجد حوادث مسجَّلة.'}

البلاغات القريبة من الحوادث (${nearMisses.length}):
${nearMisses.map((n) => `- ${n.near_miss_no} | ${n.description} | ${n.location || '-'} | سبب: ${n.cause || '-'} | مستوى: ${n.risk_level}`).join('\n') || 'لا توجد بلاغات.'}

المخاطر المفتوحة (${risks.length}) مرتبة تنازلياً بالدرجة:
${risks.map((r) => `- ${r.risk_no} | ${r.title} | فئة: ${r.category} | ${r.location || '-'} | مستوى: ${r.risk_level} (${r.risk_score}/25)`).join('\n') || 'لا مخاطر مفتوحة.'}

المخالفات (${violations.length}):
${violations.map((v) => `- ${v.violation_no} | ${v.violation_type} | خطورة: ${v.severity} | ${v.location || '-'} | حالة: ${v.status}`).join('\n') || 'لا مخالفات.'}

نتائج آخر التفتيشات (${inspections.length}):
${inspections.map((i) => `- ${i.inspection_no} | ${i.inspection_type} | ${i.inspection_date} | نتيجة: ${i.overall_result}`).join('\n') || 'لا تفتيشات.'}

إجراءات تصحيحية متأخرة (${overdueActions.length}):
${overdueActions.map((a) => `- ${a.action_no} | ${a.description} | مستحق: ${a.due_date} | حالة: ${a.status}`).join('\n') || 'لا إجراءات متأخرة.'}
`.trim();

  return { incidents, nearMisses, risks, violations, inspections, overdueActions, text };
}

/** تحليل شامل: اكتشاف الأنماط + الأسباب الجذرية المتكررة + توقّع أكثر المناطق/الأنشطة خطورة
 * (يجمع ثلاث قدرات من البند 21/الوثيقة الأولى لأنها تعتمد على نفس السياق بالضبط). */
export async function analyzeSafetyPatterns(project_id) {
  const context = buildSafetyContext(project_id);
  const system = `أنت مساعد تحليل سلامة مهنية خبير بمعايير ISO 45001 وOSHA. حلّل بيانات السلامة الحقيقية التالية
لمشروع إنشائي واستخرج: الأنماط المتكررة، الأسباب الجذرية الشائعة، والمناطق/الأنشطة الأعلى خطورة مستقبلاً بناءً
على التاريخ الفعلي فقط - لا تخترع بيانات غير موجودة في السياق. أجب بصيغة JSON فقط بلا أي نص إضافي، بالمفاتيح:
{"patterns": [{"pattern": "...", "evidence": "...", "affected_count": رقم}], "recurring_root_causes": [{"cause": "...", "frequency_note": "..."}],
"predicted_high_risk_areas": [{"area_or_activity": "...", "reasoning": "..."}], "reasoning": "ملخص عام قصير"}`;
  const text = await callClaude(system, `بيانات مشروع${project_id ? ` رقم ${project_id}` : 'ات كل المشاريع'}:\n\n${context.text}`);
  return { ...parseJsonResponse(text), disclaimer: SAFETY_DISCLAIMER, based_on: { incidents: context.incidents.length, near_misses: context.nearMisses.length, open_risks: context.risks.length } };
}

/** اقتراح إجراءات وقائية لخطر أو حادث محدد (البند 21: "اقتراح إجراءات وقائية"). */
export async function suggestPreventiveActions({ project_id, subject_type, subject_description }) {
  if (!subject_description) throw Object.assign(new Error('وصف الحالة (خطر/حادث) مطلوب لاقتراح إجراءات وقائية.'), { code: 'AI_INVALID_RESPONSE' });
  const context = buildSafetyContext(project_id);
  const system = `أنت خبير سلامة مهنية. بناءً على وصف الحالة التالية وسياق سلامة المشروع الفعلي، اقترح إجراءات
وقائية عملية وقابلة للتنفيذ فوراً في موقع إنشاءات، متوافقة مع ISO 45001/OSHA. أجب بصيغة JSON فقط:
{"suggested_actions": [{"action": "...", "priority": "high|medium|low", "responsible_role_suggestion": "..."}], "reasoning": "..."}`;
  const text = await callClaude(system, `نوع الحالة: ${subject_type || 'غير محدد'}\nالوصف: ${subject_description}\n\nسياق سلامة المشروع:\n${context.text}`);
  return { ...parseJsonResponse(text), disclaimer: SAFETY_DISCLAIMER };
}

/** تقييم أداء فريق السلامة + خطة تحسين (الوثيقة الأولى: قدرتان مترابطتان بنفس المدخلات). */
export async function generateSafetyImprovementPlan(project_id) {
  const context = buildSafetyContext(project_id);
  const system = `أنت استشاري نظم إدارة السلامة المهنية. قيّم أداء فريق السلامة بناءً على البيانات الفعلية (سرعة
إغلاق الإجراءات التصحيحية، تكرار المخالفات، نتائج التفتيش) واقترح خطة تحسين سلامة من 3 إلى 6 بنود عملية.
أجب بصيغة JSON فقط: {"performance_assessment": "...", "strengths": ["..."], "gaps": ["..."],
"improvement_plan": [{"item": "...", "expected_impact": "..."}], "reasoning": "..."}`;
  const text = await callClaude(system, context.text);
  return { ...parseJsonResponse(text), disclaimer: SAFETY_DISCLAIMER };
}

/** تلخيص تقارير السلامة/التفتيش وإنشاء تقرير تحليلي تنفيذي مختصر للإدارة (الوثيقة الأولى). */
export async function summarizeSafetyReport({ project_id, dashboard }) {
  const context = buildSafetyContext(project_id);
  const system = `أنت تكتب ملخصاً تنفيذياً قصيراً (فقرتان إلى ثلاث) لإدارة شركة مقاولات حول وضع السلامة المهنية
في المشروع، بناءً على المؤشرات والبيانات الفعلية التالية فقط. أجب بصيغة JSON فقط:
{"executive_summary": "نص الملخص", "key_concerns": ["..."], "recommended_next_steps": ["..."], "reasoning": "..."}`;
  const kpiText = dashboard ? `\n\nمؤشرات الأداء الحالية: ${JSON.stringify(dashboard.kpis)}\nالإجماليات: ${JSON.stringify(dashboard.totals)}` : '';
  const text = await callClaude(system, context.text + kpiText);
  return { ...parseJsonResponse(text), disclaimer: SAFETY_DISCLAIMER };
}
