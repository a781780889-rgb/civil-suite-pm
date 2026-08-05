import { NextResponse } from 'next/server';
import { listTrainingCourses, createTrainingCourse } from '@/lib/hse/db/training.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_training', 'view');
    const courses = listTrainingCourses({ project_id: searchParams.get('project_id') || undefined, category: searchParams.get('category') || undefined });
    return NextResponse.json({ success: true, courses });
  } catch (err) {
    return handleHseError(err);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'hse_training', 'create');
    const course = createTrainingCourse(body, actor);
    return NextResponse.json({ success: true, course }, { status: 201 });
  } catch (err) {
    return handleHseError(err);
  }
}
