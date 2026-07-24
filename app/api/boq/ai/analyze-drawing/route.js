// app/api/boq/ai/analyze-drawing/route.js
import { NextResponse } from 'next/server';
import { analyzeDrawingImage } from '@/lib/boq/ai.js';

export async function POST(request) {
  try {
    const body = await request.json();
    if (!body.imageBase64) {
      return NextResponse.json({ success: false, errors: ['لم تُرفَع صورة للتحليل.'] }, { status: 400 });
    }
    const suggestions = await analyzeDrawingImage({
      imageBase64: body.imageBase64,
      mediaType: body.mediaType || 'image/png',
      notes: body.notes || '',
    });
    return NextResponse.json({ success: true, suggestions, disclaimer: 'اقتراحات أولية من الذكاء الاصطناعي تتطلب مراجعة واعتماداً يدوياً قبل إضافتها لحصر الكميات - لم يُحفَظ أي شيء بعد.' });
  } catch (err) {
    const status = err.code === 'AI_NOT_CONFIGURED' ? 503 : err.code === 'AI_INVALID_RESPONSE' ? 502 : 500;
    console.error(err);
    return NextResponse.json({ success: false, errors: [err.message || 'تعذّر تحليل المخطط.'], code: err.code || null }, { status });
  }
}
