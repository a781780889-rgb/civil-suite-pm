import { NextResponse } from 'next/server';
import { listCertifications, issueCertification } from '@/lib/hse/db/training.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError, pageParams } from '@/lib/hse/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_training', 'view');
    const data = listCertifications({
      course_id: searchParams.get('course_id') || undefined, trainee_name: searchParams.get('trainee_name') || undefined,
      status: searchParams.get('status') || undefined, ...pageParams(searchParams),
    });
    return NextResponse.json({ success: true, ...data });
  } catch (err) {
    return handleHseError(err);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'hse_training', 'create');
    const certification = issueCertification(body, actor);
    return NextResponse.json({ success: true, certification }, { status: 201 });
  } catch (err) {
    return handleHseError(err);
  }
}
