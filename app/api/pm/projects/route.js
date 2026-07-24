import { NextResponse } from 'next/server';
import { listProjectsPaged, createProjectFull, findDuplicateProjectCode } from '@/lib/pm/db/projects.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handlePmError, pageParams } from '@/lib/pm/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize } = pageParams(searchParams);
    const result = listProjectsPaged({
      status: searchParams.get('status') || undefined,
      priority: searchParams.get('priority') || undefined,
      search: searchParams.get('search') || undefined,
      is_archived: searchParams.get('is_archived') === '1',
      page, pageSize,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return handlePmError(err);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'project', 'create');
    if (!body.name) return NextResponse.json({ success: false, error: 'اسم المشروع مطلوب.' }, { status: 400 });
    if (body.project_code && findDuplicateProjectCode(body.project_code)) {
      return NextResponse.json({ success: false, error: `رقم المشروع "${body.project_code}" مستخدم بالفعل في مشروع آخر.` }, { status: 409 });
    }
    const project = createProjectFull({ ...body, actor });
    return NextResponse.json({ success: true, project }, { status: 201 });
  } catch (err) {
    return handlePmError(err);
  }
}
