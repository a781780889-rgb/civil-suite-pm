import { NextResponse } from 'next/server';
import { getIncidentById, updateIncident } from '@/lib/hse/db/incidents.js';
import { assertPermission, PmPermissionError } from '@/lib/pm/roles.js';
import { getActor, handleHseError } from '@/lib/hse/apiHelpers.js';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_incident', 'view');
    const incident = getIncidentById(Number(id));
    if (!incident) return NextResponse.json({ success: false, error: 'الحادث غير موجود.' }, { status: 404 });
    return NextResponse.json({ success: true, incident });
  } catch (err) {
    return handleHseError(err);
  }
}

/** العامل (worker) يملك edit على hse_incident لغرض الإبلاغ الذاتي فقط - نقيّد تعديله هنا على
 * سجلاته هو فقط (reported_by يطابق actor)، تماماً كالقيد الموثّق في تعليق دور worker بـroles.js. */
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'hse_incident', 'edit');
    if (actor_role === 'worker') {
      const existing = getIncidentById(Number(id));
      if (existing && existing.reported_by && existing.reported_by !== actor) {
        throw new PmPermissionError(actor_role, 'hse_incident', 'edit_others_report');
      }
    }
    const incident = updateIncident(Number(id), body, actor);
    return NextResponse.json({ success: true, incident });
  } catch (err) {
    return handleHseError(err);
  }
}
