// app/api/projects/route.js
import { NextResponse } from 'next/server';
import { listProjects, createProject } from '@/lib/db.js';

export async function GET() {
  try {
    const rows = listProjects();
    return NextResponse.json({ success: true, projects: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, errors: ['تعذّر جلب المشاريع.'] }, { status: 500 });
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, errors: ['طلب غير صالح.'] }, { status: 400 });
  }
  if (!body?.name) {
    return NextResponse.json({ success: false, errors: ['اسم المشروع مطلوب.'] }, { status: 422 });
  }
  try {
    const project = createProject(body);
    return NextResponse.json({ success: true, project });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, errors: ['تعذّر إنشاء المشروع.'] }, { status: 500 });
  }
}
