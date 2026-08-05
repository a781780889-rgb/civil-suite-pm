import { NextResponse } from 'next/server';
import { markAllNotificationsRead } from '@/lib/hse/db/notifications.js';
import { handleHseError } from '@/lib/hse/apiHelpers.js';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    markAllNotificationsRead(body.project_id || null);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleHseError(err);
  }
}
