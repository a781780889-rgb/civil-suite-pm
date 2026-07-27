import { NextResponse } from 'next/server';
import { listCommitmentsPaged, createCommitment, refreshOverdueCommitments } from '@/lib/business/db/commitments.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleBizError, pageParams } from '@/lib/business/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'biz_commitment', 'view');
    refreshOverdueCommitments();
    const result = listCommitmentsPaged({
      status: searchParams.get('status') || undefined,
      entity_type: searchParams.get('entity_type') || undefined,
      entity_id: searchParams.get('entity_id') || undefined,
      overdue: searchParams.get('overdue') === '1',
      ...pageParams(searchParams),
    });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return handleBizError(err);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'biz_commitment', 'create');
    const created = createCommitment({ ...body, actor });
    return NextResponse.json({ success: true, commitment: created }, { status: 201 });
  } catch (err) {
    return handleBizError(err);
  }
}
