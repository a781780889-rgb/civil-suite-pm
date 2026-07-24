import { NextResponse } from 'next/server';
import { markNotificationRead } from '@/lib/pm/db/notifications.js';
import { handlePmError } from '@/lib/pm/apiHelpers.js';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const notification = markNotificationRead(Number(id), body.is_read !== false);
    return NextResponse.json({ success: true, notification });
  } catch (err) {
    return handlePmError(err);
  }
}
