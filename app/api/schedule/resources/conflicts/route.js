import { NextResponse } from 'next/server';
import { findAllResourceConflicts, findResourceConflicts } from '@/lib/schedule/db/resources.js';
import { getActor, handlePmError } from '@/lib/pm/apiHelpers.js';
import { assertPermission } from '@/lib/pm/roles.js';

export async function GET(request) {
  try {
    const { actor_role } = getActor({}, request);
    assertPermission(actor_role, 'schedule', 'view');
    const { searchParams } = new URL(request.url);
    const resourceId = searchParams.get('resource_id');
    if (resourceId) {
      return NextResponse.json({ success: true, conflicts: findResourceConflicts(Number(resourceId)) });
    }
    return NextResponse.json({ success: true, conflictsByResource: findAllResourceConflicts() });
  } catch (err) {
    return handlePmError(err);
  }
}
