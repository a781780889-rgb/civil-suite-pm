import { NextResponse } from 'next/server';
import { listReadings, recordHourMeterReading } from '@/lib/equipment/db/hourMeter.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleEquipError } from '@/lib/equipment/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const equipment_id = searchParams.get('equipment_id');
    if (!equipment_id) return NextResponse.json({ success: false, error: 'equipment_id مطلوب.' }, { status: 400 });
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'equipment_operation', 'view');
    const data = listReadings(equipment_id, { page: searchParams.get('page') || undefined, pageSize: searchParams.get('pageSize') || undefined });
    return NextResponse.json({ success: true, ...data });
  } catch (err) {
    return handleEquipError(err);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'equipment_operation', 'edit');
    // تعديل رجعي لقراءة العداد (allowBackward) يتطلب صلاحية اعتماد خاصة - دفاع إضافي هنا فوق فحص hourMeter.js نفسه.
    const allowBackward = Boolean(body.allowBackward);
    if (allowBackward) assertPermission(actor_role, 'equipment', 'approve');
    const reading = recordHourMeterReading(body.equipment_id, body.reading_value, {
      source: 'manual', recordedBy: actor, overrideReason: body.override_reason, readingDate: body.reading_date, allowBackward,
    });
    return NextResponse.json({ success: true, reading }, { status: 201 });
  } catch (err) {
    return handleEquipError(err);
  }
}
