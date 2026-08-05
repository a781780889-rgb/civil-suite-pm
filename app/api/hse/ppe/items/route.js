import { NextResponse } from 'next/server';
import { listPpeItems, createPpeItem } from '@/lib/hse/db/ppe.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_ppe', 'view');
    const items = listPpeItems({ item_type: searchParams.get('item_type') || undefined, includeArchived: searchParams.get('includeArchived') === 'true' });
    return NextResponse.json({ success: true, items });
  } catch (err) {
    return handleHseError(err);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'hse_ppe', 'create');
    const item = createPpeItem(body, actor);
    return NextResponse.json({ success: true, item }, { status: 201 });
  } catch (err) {
    return handleHseError(err);
  }
}
