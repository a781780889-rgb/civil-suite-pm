import { NextResponse } from 'next/server';
import { listBizNotifications, countBizUnread, markAllBizRead } from '@/lib/business/db/notifications.js';
import { runBusinessNotificationScan } from '@/lib/business/notificationsScan.js';
import { getActor, handleBizError } from '@/lib/business/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    runBusinessNotificationScan();
    const is_read = searchParams.get('is_read');
    const notifications = listBizNotifications({ is_read: is_read === null ? undefined : is_read === '1', limit: Number(searchParams.get('limit')) || 100 });
    return NextResponse.json({ success: true, notifications, unreadCount: countBizUnread() });
  } catch (err) {
    return handleBizError(err);
  }
}

/** body.action === 'mark_all_read' لتصفير كل التنبيهات دفعة واحدة. */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    getActor(body, request);
    if (body.action === 'mark_all_read') return NextResponse.json({ success: true, ...markAllBizRead() });
    const result = runBusinessNotificationScan();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return handleBizError(err);
  }
}
