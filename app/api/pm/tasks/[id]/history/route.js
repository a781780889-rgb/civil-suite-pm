import { NextResponse } from 'next/server';
import { listTaskHistory } from '@/lib/pm/db/tasks.js';
import { handlePmError } from '@/lib/pm/apiHelpers.js';

export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    return NextResponse.json({ success: true, history: listTaskHistory(Number(id)) });
  } catch (err) {
    return handlePmError(err);
  }
}
