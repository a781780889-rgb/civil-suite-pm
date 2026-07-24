import { NextResponse } from 'next/server';
import { getProjectById } from '@/lib/pm/db/projects.js';
import { getProjectStats } from '@/lib/pm/db/projectStats.js';
import { askProjectAssistant } from '@/lib/pm/ai.js';
import { handlePmError } from '@/lib/pm/apiHelpers.js';

export async function POST(request) {
  try {
    const body = await request.json();
    if (!body.project_id || !body.question) return NextResponse.json({ success: false, error: 'project_id والسؤال مطلوبان.' }, { status: 400 });
    const project = getProjectById(Number(body.project_id));
    if (!project) return NextResponse.json({ success: false, error: 'المشروع غير موجود.' }, { status: 404 });
    // نُرسل نفس ملخص "نظرة عامة" الحقيقي المعروض في الواجهة كسياق - بيانات فعلية فقط، بلا اختلاق.
    const stats = getProjectStats(project.id);
    const answer = await askProjectAssistant({ project, contextData: stats, question: body.question });
    return NextResponse.json({ success: true, answer });
  } catch (err) {
    return handlePmError(err);
  }
}
