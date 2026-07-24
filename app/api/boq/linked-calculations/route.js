// app/api/boq/linked-calculations/route.js
// يُعيد الحسابات المحفوظة القابلة للربط بعنصر حصر كميات - naming: kind=rebar يُعيد حسابات
// حديد التسليح فقط (calc_type يبدأ بـ rebar_)، kind=concrete يُعيد حسابات القسم الأول فقط
// (كل ما لا يبدأ بـ rebar_) - يلبي واجهة اختيار "ربط بحساب محفوظ" في نموذج إضافة العنصر.
import { NextResponse } from 'next/server';
import { listCalculations } from '@/lib/db.js';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get('kind') === 'rebar' ? 'rebar' : 'concrete';
  const projectId = searchParams.get('project_id') || undefined;

  const all = listCalculations({ project_id: projectId, limit: 300 });
  const filtered = all.filter((c) => (kind === 'rebar' ? c.calc_type.startsWith('rebar_') : !c.calc_type.startsWith('rebar_')));
  return NextResponse.json({ success: true, calculations: filtered });
}
