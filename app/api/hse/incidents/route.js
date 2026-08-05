import { NextResponse } from 'next/server';
import { listIncidents, createIncident } from '@/lib/hse/db/incidents.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError, pageParams } from '@/lib/hse/apiHelpers.js';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_incident', 'view');
    const data = listIncidents({
      project_id: searchParams.get('project_id') || undefined, site_id: searchParams.get('site_id') || undefined,
      status: searchParams.get('status') || undefined, incident_type: searchParams.get('incident_type') || undefined,
      from: searchParams.get('from') || undefined, to: searchParams.get('to') || undefined, ...pageParams(searchParams),
    });
    return NextResponse.json({ success: true, ...data });
  } catch (err) {
    return handleHseError(err);
  }
}

/** أي دور يملك مستوى edit على الأقل على hse_incident يستطيع الإنشاء - بما فيها العامل نفسه
 * (تقرير ذاتي، البند "ثقافة إبلاغ بلا لوم" الموثّقة في lib/pm/roles.js). */
export async function POST(request) {
  try {
    const body = await request.json();
    const { actor, actor_role } = getActor(body, request);
    assertPermission(actor_role, 'hse_incident', 'create');
    const incident = createIncident(body, actor);
    return NextResponse.json({ success: true, incident }, { status: 201 });
  } catch (err) {
    return handleHseError(err);
  }
}
