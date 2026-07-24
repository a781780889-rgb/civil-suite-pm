import { NextResponse } from 'next/server';
import { getAllResourceConflicts } from '@/lib/pm/db/resources.js';
import { handlePmError } from '@/lib/pm/apiHelpers.js';

export async function GET() {
  try {
    return NextResponse.json({ success: true, conflicts: getAllResourceConflicts() });
  } catch (err) {
    return handlePmError(err);
  }
}
