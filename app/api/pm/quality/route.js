import { NextResponse } from 'next/server';
import { listQualityRecords, createQualityRecord } from '@/lib/pm/db/quality.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    if (!projectId) return NextResponse.json({ success: false, error: 'project_id مطلوب.' }, { status: 400 });
    return NextResponse.json({
      success: true,
      records: listQualityRecords({ project_id: Number(projectId), record_type: searchParams.get('record_type') || undefined, status: searchParams.get('status') || undefined }),
    });
  } catch (err) {
    return handlePmError(err);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'quality', 'create');
    if (!body.project_id || !body.title || !body.record_type) return NextResponse.json({ success: false, error: 'project_id ونوع السجل والعنوان مطلوبة.' }, { status: 400 });
    const record = createQualityRecord({ ...body, actor });
    return NextResponse.json({ success: true, record }, { status: 201 });
  } catch (err) {
    return handlePmError(err);
  }
}
