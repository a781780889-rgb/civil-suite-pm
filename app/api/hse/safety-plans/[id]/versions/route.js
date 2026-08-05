import { NextResponse } from 'next/server';
import { addSafetyPlanVersion } from '@/lib/hse/db/safetyPlans.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { handleHseError } from '@/lib/hse/apiHelpers.js';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const form = await request.formData();
    const actor = form.get('actor') || null;
    const actor_role = form.get('actor_role') || 'hse_manager';
    assertPermission(actor_role, 'document', 'edit');
    const document = await addSafetyPlanVersion(Number(id), { file: form.get('file'), uploaded_by: actor, notes: form.get('notes') || null }, actor);
    return NextResponse.json({ success: true, document }, { status: 201 });
  } catch (err) {
    return handleHseError(err);
  }
}
