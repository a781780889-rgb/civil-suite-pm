import { NextResponse } from 'next/server';
import { listNotifications } from '@/lib/hse/db/notifications.js';
import { runHseNotificationScan } from '@/lib/hse/notificationsScan.js';
import { getActor, handleHseError, pageParams } from '@/lib/hse/apiHelpers.js';

/** يشغّل فحص التنبيهات الحقيقي عند كل طلب (البند 18) قبل القراءة - نفس نمط
 * lib/equipment/notificationsScan.js تماماً (لا Cron منفصل في بيئة Next.js API routes الخالصة). */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const project_id = searchParams.get('project_id') ? Number(searchParams.get('project_id')) : undefined;
    runHseNotificationScan(project_id);
    const data = listNotifications({ project_id, is_read: searchParams.has('is_read') ? searchParams.get('is_read') === 'true' : undefined, ...pageParams(searchParams) });
    return NextResponse.json({ success: true, ...data });
  } catch (err) {
    return handleHseError(err);
  }
}
