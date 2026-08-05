import { NextResponse } from 'next/server';
import { listSafetyPlanDocuments, createSafetyPlanDocument } from '@/lib/hse/db/safetyPlans.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { handleHseError } from '@/lib/hse/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const actor_role = searchParams.get('actor_role') || 'hse_manager';
    assertPermission(actor_role, 'document', 'view');
    const documents = listSafetyPlanDocuments({ project_id: searchParams.get('project_id') || undefined, category: searchParams.get('category') || undefined });
    return NextResponse.json({ success: true, documents });
  } catch (err) {
    return handleHseError(err);
  }
}

export async function POST(request) {
  try {
    const form = await request.formData();
    const actor = form.get('actor') || null;
    const actor_role = form.get('actor_role') || 'hse_manager';
    assertPermission(actor_role, 'document', 'create');
    const document = await createSafetyPlanDocument({
      project_id: Number(form.get('project_id')), category: form.get('category'), name: form.get('name'),
      file: form.get('file'), uploaded_by: actor, notes: form.get('notes') || null,
    }, actor);
    return NextResponse.json({ success: true, document }, { status: 201 });
  } catch (err) {
    return handleHseError(err);
  }
}
