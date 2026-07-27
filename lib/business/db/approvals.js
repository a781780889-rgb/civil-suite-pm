// lib/business/db/approvals.js
// =============================================================================
// سجل موافقات عام (Workflow) - البند الثامن عشر من القواعد الإلزامية: "أي عملية حساسة
// (اعتماد عقد/عرض سعر/تعديل قيمة عقد/اعتماد أمر تغيير/اعتماد دفعة) يجب أن تمر عبر Workflow
// واضح للموافقات، ويجب حفظ: الشخص الذي وافق، التاريخ، الوقت، القرار، الملاحظات".
// جدول واحد يخدم كل الكيانات القابلة للاعتماد (عرض سعر/عقد/أمر تغيير/مستخلص) بدل تكرار نفس
// الأعمدة الخمسة في كل جدول - كل دالة create*/decide* في db/quotes.js وdb/contracts.js
// وdb/changeOrders.js وdb/progressPayments.js تستدعي recordApproval بعد كل قرار فعلي.
// =============================================================================
import { bdb } from '../schema.js';

/** action: 'submit' | 'approve' | 'reject' */
export function recordApproval(db, { entity_type, entity_id, action, decision, notes, actor, actor_role }) {
  db.prepare(
    `INSERT INTO biz_approvals (entity_type, entity_id, action, decision, notes, actor, actor_role)
     VALUES (@entity_type, @entity_id, @action, @decision, @notes, @actor, @actor_role)`
  ).run({
    entity_type, entity_id, action,
    decision: decision || null,
    notes: notes || null,
    actor: actor || null,
    actor_role: actor_role || null,
  });
}

export function listApprovals({ entity_type, entity_id }) {
  return bdb()
    .prepare(`SELECT * FROM biz_approvals WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC`)
    .all(entity_type, entity_id);
}
