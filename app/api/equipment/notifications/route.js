import { NextResponse } from 'next/server';
import { listNotifications, markAllNotificationsRead } from '@/lib/equipment/db/notifications.js';
import { runEquipmentNotificationScan } from '@/lib/equipment/notificationsScan.js';
import { getActor, handleEquipError } from '@/lib/equipment/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    runEquipmentNotificationScan();
    const data = listNotifications({
      equipment_id: searchParams.get('equipment_id') || undefined,
      unreadOnly: searchParams.get('unreadOnly') === 'true',
      page: searchParams.get('page') || undefined,
      pageSize: searchParams.get('pageSize') || undefined,
    });
    return NextResponse.json({ success: true, ...data });
  } catch (err) {
    return handleEquipError(err);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    getActor(body, request);
    if (body.action === 'mark_all_read') {
      const result = markAllNotificationsRead(body.equipment_id || null);
      return NextResponse.json({ success: true, ...result });
    }
    return NextResponse.json({ success: false, error: 'إجراء غير معروف.' }, { status: 400 });
  } catch (err) {
    return handleEquipError(err);
  }
}
