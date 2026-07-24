import { NextResponse } from 'next/server';
import { getConflictsForResource } from '@/lib/pm/db/resources.js';
import { handlePmError } from '@/lib/pm/apiHelpers.js';

export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    return NextResponse.json({ success: true, conflicts: getConflictsForResource(Number(id)) });
  } catch (err) {
    return handlePmError(err);
  }
}
