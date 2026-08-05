// lib/equipment/apiHelpers.js
// نفس نمط lib/business/apiHelpers.js (الموسّع بدوره من lib/pm/apiHelpers.js) تماماً - يعيد
// استخدام PmPermissionError وValidationError نفسيهما (فئتا خطأ عامتان مشتركتان في المنصة)
// بدل تكرارهما لهذا القسم.
import { NextResponse } from 'next/server';
import { PmPermissionError } from '../pm/roles.js';
import { ValidationError } from '../calc/common.js';

/** يستخرج هوية الفاعل (actor) ودوره (actor_role) من الطلب - جسم الطلب أولاً، ثم رؤوس الطلب، ثم افتراضي. */
export function getActor(body, request) {
  const actor = body?.actor || request?.headers?.get?.('x-equip-actor') || null;
  const actor_role = body?.actor_role || request?.headers?.get?.('x-equip-actor-role') || 'equipment_manager';
  return { actor, actor_role };
}

export function handleEquipError(err) {
  if (err instanceof PmPermissionError) {
    return NextResponse.json({ success: false, error: err.message, code: err.code }, { status: 403 });
  }
  if (err instanceof ValidationError) {
    return NextResponse.json({ success: false, error: err.message, messages: err.messages }, { status: 400 });
  }
  if (err.code === 'AI_NOT_CONFIGURED') {
    return NextResponse.json({ success: false, error: err.message, code: err.code }, { status: 503 });
  }
  if (err.code === 'AI_REQUEST_FAILED' || err.code === 'AI_INVALID_RESPONSE') {
    return NextResponse.json({ success: false, error: err.message, code: err.code, rawResponse: err.rawResponse }, { status: 502 });
  }
  if (err.code === 'EQUIP_CONFLICT') {
    return NextResponse.json({ success: false, error: err.message, code: err.code, conflicts: err.conflicts }, { status: 409 });
  }
  const msg = err?.message || 'خطأ غير متوقع في الخادم.';
  const status = /غير موجود(ة)?\.?$/.test(msg) ? 404 : 400;
  return NextResponse.json({ success: false, error: msg }, { status });
}

export function pageParams(searchParams) {
  const page = searchParams.get('page') ? Number(searchParams.get('page')) : undefined;
  const pageSize = searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : undefined;
  return { page, pageSize };
}

/** خطأ تعارض حجز/تخصيص (البند 6: "منع الحجز المتعارض") - يُعرض للمستخدم كتنبيه واضح لا 500 صامت. */
export class EquipConflictError extends Error {
  constructor(message, conflicts = []) {
    super(message);
    this.name = 'EquipConflictError';
    this.code = 'EQUIP_CONFLICT';
    this.conflicts = conflicts;
  }
}
