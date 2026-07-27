// lib/business/db/changeOrders.js — إدارة التغييرات التجارية، البند العاشر من القواعد الإلزامية.
// "لا يتم تحديث قيمة العقد إلا بعد اعتماد التغيير" - applyContractValueDelta لا تُستدعى إلا من decide() هنا.
import { randomUUID } from 'crypto';
import { bdb } from '../schema.js';
import { writeBizAudit } from './audit.js';
import { recordApproval } from './approvals.js';
import { getContractById, applyContractValueDelta } from './contracts.js';
import { createBudgetItem } from '../../pm/db/budget.js';

export function listChangeOrders(contractId) {
  return bdb().prepare(`SELECT * FROM biz_change_orders WHERE contract_id = ? ORDER BY created_at DESC`).all(contractId);
}

export function getChangeOrderById(id) {
  return bdb().prepare(`SELECT * FROM biz_change_orders WHERE id = ?`).get(id);
}

export function createChangeOrder(contractId, data) {
  const db = bdb();
  const run = db.transaction(() => {
    const contract = getContractById(contractId);
    if (!contract) throw new Error('العقد غير موجود.');
    if (!data.description) throw new Error('وصف التغيير مطلوب.');
    const uuid = randomUUID();
    const info = db
      .prepare(
        `INSERT INTO biz_change_orders (uuid, co_no, contract_id, description, reason, delta_value, duration_impact_days, status, requested_by)
         VALUES (@uuid, @co_no, @contract_id, @description, @reason, @delta_value, @duration_impact_days, 'draft', @requested_by)`
      )
      .run({
        uuid, co_no: data.co_no || null, contract_id: contractId, description: data.description,
        reason: data.reason || null, delta_value: Number(data.delta_value) || 0,
        duration_impact_days: Number(data.duration_impact_days) || 0, requested_by: data.actor || null,
      });
    const created = getChangeOrderById(info.lastInsertRowid);
    writeBizAudit(db, { entity_type: 'change_order', entity_id: created.id, action: 'create', before: null, after: created, actor: data.actor });
    return created;
  });
  return run();
}

export function submitChangeOrder(id, { actor, actor_role }) {
  const db = bdb();
  const run = db.transaction(() => {
    const before = getChangeOrderById(id);
    if (!before) throw new Error('أمر التغيير غير موجود.');
    db.prepare(`UPDATE biz_change_orders SET status='pending_approval', updated_at=datetime('now') WHERE id=?`).run(id);
    recordApproval(db, { entity_type: 'change_order', entity_id: id, action: 'submit', decision: 'pending_approval', actor, actor_role });
    const after = getChangeOrderById(id);
    writeBizAudit(db, { entity_type: 'change_order', entity_id: id, action: 'submit', before, after, actor });
    return after;
  });
  return run();
}

/** اعتماد أو رفض أمر تغيير - عند الاعتماد فقط: يحدّث قيمة العقد فعلياً + يسجّل بنداً في ميزانية
 * مشروع القسم الرابع المرتبط (إن وُجد) - تكامل حقيقي بلا تكرار بيانات (البند 16). */
export function decideChangeOrder(id, { approved, notes, actor, actor_role }) {
  const db = bdb();
  const run = db.transaction(() => {
    const before = getChangeOrderById(id);
    if (!before) throw new Error('أمر التغيير غير موجود.');
    if (before.status !== 'pending_approval') throw new Error('لا يمكن اتخاذ قرار إلا على أمر تغيير بحالة "بانتظار الاعتماد".');
    const status = approved ? 'approved' : 'rejected';
    db.prepare(`UPDATE biz_change_orders SET status=@status, decided_by=@decided_by, decided_at=datetime('now'), updated_at=datetime('now') WHERE id=@id`)
      .run({ id, status, decided_by: actor || null });
    recordApproval(db, { entity_type: 'change_order', entity_id: id, action: approved ? 'approve' : 'reject', decision: status, notes, actor, actor_role });
    const after = getChangeOrderById(id);
    writeBizAudit(db, { entity_type: 'change_order', entity_id: id, action: approved ? 'approve' : 'reject', before, after, actor });

    if (approved) {
      const contract = applyContractValueDelta(db, before.contract_id, before.delta_value, before.duration_impact_days, actor);
      if (contract.project_id) {
        try {
          createBudgetItem({
            project_id: contract.project_id, item_type: 'change_order',
            category: 'أمر تغيير تجاري', description: `${before.co_no || '#' + before.id}: ${before.description}`,
            amount: before.delta_value, date: new Date().toISOString().slice(0, 10),
            reference_no: before.co_no || String(before.id), status: 'recorded', actor,
          });
        } catch {
          /* المشروع المرتبط قد يكون أُرشف أو حُذف لاحقاً - لا نفشل اعتماد أمر التغيير بسبب ذلك */
        }
      }
    }
    return after;
  });
  return run();
}
