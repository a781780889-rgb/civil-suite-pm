import { NextResponse } from 'next/server';
import { listProjectStatusHistory } from '@/lib/pm/db/projects.js';
import { handlePmError } from '@/lib/pm/apiHelpers.js';

export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    const history = listProjectStatusHistory(Number(id));
    return NextResponse.json({ success: true, history });
  } catch (err) {
    return handlePmError(err);
  }
}
