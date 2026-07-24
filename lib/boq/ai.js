// lib/boq/ai.js
// =============================================================================
// مساعد الذكاء الاصطناعي لتحليل المخططات (القسم الثالث، البند 15 وقواعد الذكاء الاصطناعي
// الإلزامية). يلتزم حرفياً بالقواعد التالية من مواصفة القسم:
//   - "استخدام الذكاء الاصطناعي كمساعد فقط وليس بديلاً عن الحسابات الهندسية"
//   - "عدم اعتماد أي نتيجة يتم توليدها بالذكاء الاصطناعي قبل التحقق منها"
//   - "إظهار مستوى الثقة في النتائج المقترحة" + "توضيح أسباب أي اقتراح"
//   - "إمكانية رفض أو اعتماد الاقتراحات من قبل المستخدم"
// لذلك: هذه الدالة لا تكتب أي شيء في قاعدة البيانات مباشرة - تُعيد فقط قائمة اقتراحات
// (كل اقتراح: confidence 0-1 + reasoning نصي)، والمسار الوحيد لتحويل اقتراح إلى عنصر BOQ
// فعلي هو نفس مسار الإنشاء اليدوي العادي (POST /api/boq/elements) بعد مراجعة المستخدم
// وتعديله إن لزم - تماماً كما لو كتبه بنفسه.
//
// يتطلب متغير بيئة ANTHROPIC_API_KEY (غير مضمّن هنا لأسباب أمنية بديهية). بلا هذا المتغير
// تُعيد الدالة خطأً واضحاً بدل الفشل الصامت أو تلفيق نتيجة.
// =============================================================================

import { CATEGORIES } from './categoryRegistry.js';

const DEFAULT_MODEL = process.env.BOQ_AI_MODEL || 'claude-sonnet-5';

const SYSTEM_PROMPT = `أنت مساعد هندسي متخصص في قراءة مخططات الإنشاءات لأغراض حصر الكميات الأولي فقط.
مهمتك الوحيدة: تحديد العناصر الإنشائية/المعمارية الظاهرة في الصورة المرفقة *مع أبعادها كما هي
مكتوبة حرفياً على المخطط فقط* (لا تحسب ولا تخمّن بعداً غير مكتوب).

قواعد صارمة يجب الالتزام بها:
1. لا تخترع أي رقم غير موجود في الصورة. إن كان البعد غير واضح أو غير مكتوب، اترك قيمته null
   ولا تضعه في dimensions إطلاقاً، واذكر ذلك في reasoning.
2. كل اقتراح يجب أن يحمل confidence بين 0 و1 يعكس وضوح الكتابة/الأبعاد فعلياً في الصورة -
   وليس ثقتك العامة بوجود العنصر. خط بعد غير واضح = ثقة منخفضة حتى لو كان العنصر واضحاً.
3. اختر suggested_category_key فقط من هذه القائمة (اترك null إن لم يوجد تطابق مناسب):
${CATEGORIES.map((c) => `   - ${c.key}: ${c.name_ar}`).join('\n')}
4. أعد JSON صِرفاً فقط - بلا أي نص قبله أو بعده أو Markdown fences.

شكل الإخراج (مصفوفة JSON فقط):
[{"element_label": "نص كما يظهر على المخطط", "suggested_category_key": "...", "dimensions": {"lengthM": 0}, "confidence": 0.0, "reasoning": "..."}]`;

/**
 * يحلل صورة مخطط (base64) عبر Claude Vision ويعيد اقتراحات BOQ أولية غير معتمدة.
 * لا يكتب في قاعدة البيانات إطلاقاً - القرار والمراجعة النهائية للمستخدم دائماً.
 */
export async function analyzeDrawingImage({ imageBase64, mediaType = 'image/png', notes = '' }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err = new Error('ميزة الذكاء الاصطناعي غير مُفعّلة: يلزم ضبط متغير البيئة ANTHROPIC_API_KEY في إعدادات الخادم أولاً.');
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }
  if (!imageBase64) throw new Error('لم تُرفَع صورة للتحليل.');

  const userText = notes
    ? `حلّل هذا المخطط لأغراض حصر كميات أولي. ملاحظات إضافية من المستخدم: ${notes}`
    : 'حلّل هذا المخطط لأغراض حصر كميات أولي.';

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: userText },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    const err = new Error(`فشل استدعاء واجهة الذكاء الاصطناعي (${response.status}). ${bodyText.slice(0, 300)}`);
    err.code = 'AI_REQUEST_FAILED';
    throw err;
  }

  const data = await response.json();
  const textBlocks = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text);
  const rawText = textBlocks.join('\n').trim();
  const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

  let suggestions;
  try {
    suggestions = JSON.parse(cleaned);
  } catch {
    const err = new Error('تعذّر تفسير استجابة الذكاء الاصطناعي كـ JSON صالح - لم تُطبَّق أي اقتراحات تلقائياً.');
    err.code = 'AI_INVALID_RESPONSE';
    err.rawResponse = rawText.slice(0, 1000);
    throw err;
  }
  if (!Array.isArray(suggestions)) {
    throw Object.assign(new Error('استجابة الذكاء الاصطناعي ليست قائمة اقتراحات صالحة.'), { code: 'AI_INVALID_RESPONSE' });
  }

  const knownKeys = new Set(CATEGORIES.map((c) => c.key));
  return suggestions.map((s, i) => ({
    id: `ai-suggestion-${i}`,
    elementLabel: s.element_label || null,
    suggestedCategoryKey: knownKeys.has(s.suggested_category_key) ? s.suggested_category_key : null,
    dimensions: s.dimensions && typeof s.dimensions === 'object' ? s.dimensions : {},
    confidence: typeof s.confidence === 'number' ? Math.max(0, Math.min(1, s.confidence)) : 0,
    reasoning: s.reasoning || '',
    accepted: false, // قرار المستخدم فقط - لا يُغيَّر تلقائياً من هذا المسار أبداً
  }));
}
