import { NextResponse } from 'next/server';
import { getProjectById, updateProjectFull, setProjectArchived, hardDeleteProject, findDuplicateProjectCode } from '@/lib/pm/db/projects.js';
import { getProjectStats } from '@/lib/pm/db/projectStats.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';

export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    const stats = getProjectStats(Number(id));
    if (!stats) return NextResponse.json({ success: false, error: 'المشروع غير موجود.' }, { status: 404 });
    return NextResponse.json({ success: true, ...stats });
  } catch (err) {
    return handlePmError(err);
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'project', 'edit');
    if (body.is_archived === false) {
      const project = setProjectArchived(Number(id), false, actor);
      return NextResponse.json({ success: true, project });
    }
    if (body.project_code) {
      const dup = findDuplicateProjectCode(body.project_code, Number(id));
      if (dup) return NextResponse.json({ success: false, error: `رقم المشروع "${body.project_code}" مستخدم بالفعل في مشروع آخر.` }, { status: 409 });
    }
    const project = updateProjectFull(Number(id), { ...body, actor });
    return NextResponse.json({ success: true, project });
  } catch (err) {
    return handlePmError(err);
  }
}

/** ?mode=hard لحذف نهائي فعلي (system_admin فقط) - وإلا أرشفة (Soft Delete) حسب قاعدة "استخدام الأرشفة بدلاً من الحذف المباشر". */
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const { actor, actor_role } = getActor(body, request);
    const mode = searchParams.get('mode');

    if (mode === 'hard') {
      if (actor_role !== 'system_admin') {
        return NextResponse.json({ success: false, error: 'الحذف النهائي يتطلب صلاحية خاصة (مدير النظام فقط) - استخدم الأرشفة بدلاً من ذلك.' }, { status: 403 });
      }
      const result = hardDeleteProject(Number(id), actor);
      return NextResponse.json({ success: true, ...result });
    }
    assertPermission(actor_role, 'project', 'delete');
    const project = setProjectArchived(Number(id), true, actor);
    return NextResponse.json({ success: true, project, archived: true });
  } catch (err) {
    return handlePmError(err);
  }
}
