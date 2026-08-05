import { NextResponse } from 'next/server';
import { markNotificationRead } from '@/lib/equipment/db/notifications.js';
import { handleEquipError } from '@/lib/equipment/apiHelpers.js';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const row = markNotificationRead(id);
    return NextResponse.json({ success: true, notification: row });
  } catch (err) {
    return handleEquipError(err);
  }
}
