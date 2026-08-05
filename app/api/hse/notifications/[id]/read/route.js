import { NextResponse } from 'next/server';
import { markNotificationRead } from '@/lib/hse/db/notifications.js';
import { handleHseError } from '@/lib/hse/apiHelpers.js';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const notification = markNotificationRead(Number(id));
    return NextResponse.json({ success: true, notification });
  } catch (err) {
    return handleHseError(err);
  }
}
