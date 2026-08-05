import { NextResponse } from 'next/server';
import { listHseAuditLog } from '@/lib/hse/db/audit.js';
import { assertPermission } from '@/lib/pm/roles.js';
import { getActor, handleHseError, pageParams } from '@/lib/hse/apiHelpers.js';

/** سجل التدقيق (البند 22) - يتطلب صلاحية full على الأقل (وليس مجرد view) لأنه سجل حسّاس
 * يعرض من فعل ماذا ومتى، بنفس القيد المطبَّق على سجلات التدقيق في بقية أقسام المنصة. */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const { actor_role } = getActor(null, request);
    assertPermission(actor_role, 'hse_risk', 'delete'); // delete → يتطلب مستوى full، أعلى بوابة صلاحية متاحة لتقييد الوصول لسجل التدقيق
    const data = listHseAuditLog({
      project_id: searchParams.get('project_id') || undefined, entity_type: searchParams.get('entity_type') || undefined,
      entity_id: searchParams.get('entity_id') || undefined, ...pageParams(searchParams),
    });
    return NextResponse.json({ success: true, ...data });
  } catch (err) {
    return handleHseError(err);
  }
}
