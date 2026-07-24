import { NextResponse } from 'next/server';
import { listResources, createResource } from '@/lib/pm/db/resources.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const resources = listResources({
      resource_type: searchParams.get('resource_type') || undefined,
      search: searchParams.get('search') || undefined,
      is_active: searchParams.get('is_active') !== null ? searchParams.get('is_active') === '1' : undefined,
    });
    return NextResponse.json({ success: true, resources });
  } catch (err) {
    return handlePmError(err);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { actor_role } = getActor(body, request);
    assertPermission(actor_role, 'resource', 'create');
    if (!body.resource_type || !body.name) return NextResponse.json({ success: false, error: 'نوع المورد والاسم مطلوبان.' }, { status: 400 });
    const resource = createResource(body);
    return NextResponse.json({ success: true, resource }, { status: 201 });
  } catch (err) {
    return handlePmError(err);
  }
}
