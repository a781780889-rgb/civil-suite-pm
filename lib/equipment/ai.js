// lib/equipment/ai.js
// المساعد الذكي (البند 26) - نفس نمط lib/pm/ai.js وlib/business/ai.js تماماً: استدعاء حقيقي
// لـ Anthropic API (لا تنبؤ عشوائي محلي)، مبني بالكامل على بيانات القسم الفعلية من قاعدة
// البيانات، والتوصيات نصية للقراءة البشرية فقط - "لا يتم تنفيذ أي إجراء تلقائياً بدون موافقة
// المستخدم" (لا توجد أي دالة هنا تكتب إلى قاعدة البيانات).
import { edb } from './schema.js';
import { getEquipmentById } from './db/equipment.js';
import { computeEquipmentCostSummary } from './db/costs.js';

const AI_MODEL = process.env.EQUIPMENT_AI_MODEL || 'claude-sonnet-5';

export async function checkEquipmentAiHealth() {
  return { configured: Boolean(process.env.ANTHROPIC_API_KEY), model: AI_MODEL };
}

async function callClaude(systemPrompt, userPrompt, { maxTokens = 1500 } = {}) {
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

/** يبني ملخصاً نصياً مضغوطاً من بيانات المعدة الحقيقية - السياق المشترك لكل استدعاءات الذكاء الاصطناعي في هذا القسم. */
function buildEquipmentContext(equipmentId) {
  const db = edb();
  const equipment = getEquipmentById(equipmentId);
  if (!equipment) throw new Error('المعدة غير موجودة.');

  const recentOps = db.prepare(`SELECT log_date, hours, activity, fuel_used_l FROM equipment_operation_logs WHERE equipment_id = ? ORDER BY log_date DESC LIMIT 20`).all(equipmentId);
  const recentFuel = db.prepare(`SELECT fill_date, quantity_l, total_cost FROM equipment_fuel_logs WHERE equipment_id = ? ORDER BY fill_date DESC LIMIT 15`).all(equipmentId);
  const recentMaint = db.prepare(`SELECT maintenance_date, maintenance_type, title, total_cost, downtime_hours FROM equipment_maintenance_records WHERE equipment_id = ? ORDER BY maintenance_date DESC LIMIT 15`).all(equipmentId);
  const breakdowns = db.prepare(`SELECT breakdown_date, description, severity, total_cost, status FROM equipment_breakdowns WHERE equipment_id = ? ORDER BY breakdown_date DESC LIMIT 15`).all(equipmentId);
  const costs = computeEquipmentCostSummary(equipmentId);

  const similar = db.prepare(`
    SELECT ea.id, ea.name, ea.current_hour_meter FROM equipment_assets ea
    WHERE ea.category_key = ? AND ea.id != ? AND ea.is_archived = 0 LIMIT 5
  `).all(equipment.category_key, equipmentId);

  return {
    equipment, costs, similar,
    text: `
معدة: ${equipment.name} (${equipment.equipment_code}) - ${equipment.category_name || equipment.category_key}
الحالة: ${equipment.status} | عداد الساعات الحالي: ${equipment.current_hour_meter}
معدل الاستهلاك المرجعي: ${equipment.rated_consumption_l_per_hour || 'غير محدد'} لتر/ساعة

آخر سجلات التشغيل (${recentOps.length}):
${recentOps.map((o) => `- ${o.log_date}: ${o.hours} ساعة، نشاط: ${o.activity || '-'}، وقود: ${o.fuel_used_l ?? '-'} لتر`).join('\n') || 'لا توجد سجلات.'}

آخر تعبئات الوقود (${recentFuel.length}):
${recentFuel.map((f) => `- ${f.fill_date}: ${f.quantity_l} لتر بتكلفة ${f.total_cost}`).join('\n') || 'لا توجد سجلات.'}

آخر سجلات الصيانة (${recentMaint.length}):
${recentMaint.map((m) => `- ${m.maintenance_date} (${m.maintenance_type}): ${m.title}، تكلفة ${m.total_cost}، توقف ${m.downtime_hours} ساعة`).join('\n') || 'لا توجد سجلات.'}

الأعطال المسجّلة (${breakdowns.length}):
${breakdowns.map((b) => `- ${b.breakdown_date} (${b.severity}/${b.status}): ${b.description}، تكلفة ${b.total_cost}`).join('\n') || 'لا توجد أعطال.'}

ملخص التكلفة: إجمالي ${costs.total_cost}، تكلفة الساعة ${costs.cost_per_hour ?? 'غير متاحة (لا ساعات تشغيل مسجّلة)'}،
MTTR ${costs.mttr_hours ?? '-'} ساعة، MTBF ${costs.mtbf_hours ?? '-'} ساعة.
    `.trim(),
  };
}

const SYSTEM_BASE = 'أنت مساعد ذكي متخصص في إدارة معدات وآليات المشاريع الإنشائية. تحلّل البيانات الفعلية المُعطاة فقط، ولا تختلق أرقاماً غير موجودة فيها. أجب بالعربية الفصحى المهنية. توصياتك للمراجعة البشرية فقط ولا تُنفَّذ تلقائياً.';

export async function predictBreakdownRisk(equipmentId) {
  const ctx = buildEquipmentContext(equipmentId);
  const prompt = `${ctx.text}\n\nبناءً على أنماط التشغيل والصيانة والأعطال أعلاه، قيّم احتمالية تعطل هذه المعدة قريباً. أعد النتيجة بصيغة JSON فقط بدون أي نص إضافي: {"risk_level": "low|medium|high", "reasoning": "شرح موجز بالعربية", "recommended_action": "توصية محددة"}`;
  const text = await callClaude(SYSTEM_BASE, prompt, { maxTokens: 600 });
  return parseJsonResponse(text);
}

export async function analyzeFuelConsumption(equipmentId) {
  const ctx = buildEquipmentContext(equipmentId);
  const prompt = `${ctx.text}\n\nحلّل نمط استهلاك الوقود لهذه المعدة مقارنة بالمعدل المرجعي، واكتشف أي شذوذ. أعد JSON فقط: {"pattern_summary": "...", "anomaly_detected": true|false, "anomaly_detail": "...", "recommendation": "..."}`;
  const text = await callClaude(SYSTEM_BASE, prompt, { maxTokens: 600 });
  return parseJsonResponse(text);
}

export async function suggestMaintenanceSchedule(equipmentId) {
  const ctx = buildEquipmentContext(equipmentId);
  const prompt = `${ctx.text}\n\nاقترح أفضل جدول صيانة وقائية مستقبلي لهذه المعدة (نوع الصيانة، الفاصل الزمني بالساعات أو الأيام) بناءً على نمط استخدامها الفعلي. أعد JSON فقط: {"suggested_items": [{"title": "...", "interval_type": "hours|days", "interval_value": رقم, "reasoning": "..."}]}`;
  const text = await callClaude(SYSTEM_BASE, prompt, { maxTokens: 800 });
  return parseJsonResponse(text);
}

export async function compareEfficiency(equipmentId) {
  const ctx = buildEquipmentContext(equipmentId);
  const similarText = ctx.similar.length
    ? ctx.similar.map((s) => `- ${s.name}: عداد ${s.current_hour_meter} ساعة`).join('\n')
    : 'لا توجد معدات أخرى من نفس التصنيف حالياً.';
  const prompt = `${ctx.text}\n\nمعدات أخرى من نفس التصنيف:\n${similarText}\n\nقارن كفاءة تكلفة هذه المعدة (تكلفة الساعة) بما هو متاح من بيانات المعدات المماثلة، واذكر إن كانت البيانات المتاحة كافية للمقارنة. أعد JSON فقط: {"comparison_summary": "...", "data_sufficient": true|false, "recommendation": "..."}`;
  const text = await callClaude(SYSTEM_BASE, prompt, { maxTokens: 600 });
  return parseJsonResponse(text);
}

export async function estimateFutureCost(equipmentId) {
  const ctx = buildEquipmentContext(equipmentId);
  const prompt = `${ctx.text}\n\nبناءً على متوسط التكاليف الفعلية المسجّلة، قدّر تكلفة التشغيل المتوقعة للشهر القادم لهذه المعدة (وقود + صيانة متوقعة). أعد JSON فقط: {"estimated_monthly_cost": رقم, "basis": "شرح أساس التقدير", "confidence": "low|medium|high"}`;
  const text = await callClaude(SYSTEM_BASE, prompt, { maxTokens: 500 });
  return parseJsonResponse(text);
}

export async function askEquipmentAssistant(equipmentId, question) {
  if (!question || !question.trim()) throw new Error('السؤال مطلوب.');
  const ctx = buildEquipmentContext(equipmentId);
  const prompt = `${ctx.text}\n\nسؤال المستخدم: ${question}\n\nأجب بإيجاز ووضوح بالاعتماد على البيانات أعلاه فقط. إن كانت البيانات غير كافية للإجابة بدقة فقل ذلك صراحة.`;
  return callClaude(SYSTEM_BASE, prompt, { maxTokens: 700 });
}

/** ملخص تنفيذي لكامل أسطول المعدات - يُستخدم في التقرير التنفيذي (البند 21). */
export async function generateFleetExecutiveSummary(dashboardStats) {
  const prompt = `
إحصائيات أسطول المعدات الحالية:
إجمالي المعدات: ${dashboardStats.total_equipment}، عاملة: ${dashboardStats.working_equipment}، متوقفة: ${dashboardStats.stopped_equipment}،
تحت الصيانة: ${dashboardStats.maintenance_equipment}، خارج الخدمة: ${dashboardStats.out_of_service_equipment}
إجمالي ساعات التشغيل: ${dashboardStats.total_operating_hours}
تكلفة التشغيل: ${dashboardStats.total_operating_cost} | تكلفة الصيانة: ${dashboardStats.total_maintenance_cost}
عدد الأعطال: ${dashboardStats.breakdown_count} (المفتوحة: ${dashboardStats.open_breakdown_count})
متوسط نسبة الاستغلال (تقديري): ${dashboardStats.avg_utilization_pct}%

اكتب ملخصاً تنفيذياً موجزاً (فقرتين كحد أقصى) بالعربية الفصحى لمدير المشروع، يبرز أهم النقاط والمخاطر والتوصيات بناءً على هذه الأرقام فقط.
  `.trim();
  return callClaude(SYSTEM_BASE, prompt, { maxTokens: 500 });
}
