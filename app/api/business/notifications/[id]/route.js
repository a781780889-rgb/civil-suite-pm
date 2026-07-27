import { NextResponse } from 'next/server';
import { markBizNotificationRead } from '@/lib/business/db/notifications.js';
import { handleBizError } from '@/lib/business/apiHelpers.js';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const updated = markBizNotificationRead(id, body.is_read !== false);
    return NextResponse.json({ success: true, notification: updated });
  } catch (err) {
    return handleBizError(err);
  }
}
