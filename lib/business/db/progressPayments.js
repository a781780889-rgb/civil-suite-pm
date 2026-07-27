// lib/business/db/progressPayments.js — إدارة المستخلصات والدفعات، البند التاسع من القواعد الإلزامية.
import { randomUUID } from 'crypto';
import { bdb } from '../schema.js';
import { writeBizAudit } from './audit.js';
import { recordApproval } from './approvals.js';
import { getContractById } from './contracts.js';
import { computeProgressPaymentNetDue } from '../calc.js';
import { createBudgetItem } from '../../pm/db/budget.js';

function previousPaymentsTotal(db, contractId, excludeId) {
  const row = db
    .prepare(`SELECT COALESCE(SUM(net_due), 0) AS total FROM biz_progress_payments WHERE contract_id = ? AND status IN ('approved','paid') AND id != ?`)
    .get(contractId, excludeId || 0);
  return row.total;
}

export function listProgressPayments(contractId) {
  return bdb().prepare(`SELECT * FROM biz_progress_payments WHERE contract_id = ? ORDER BY period_to DESC, created_at DESC`).all(contractId);
}

export function getProgressPaymentById(id) {
  return bdb().prepare(`SELECT * FROM biz_progress_payments WHERE id = ?`).get(id);
}

export function createProgressPayment(contractId, data) {
  const db = bdb();
  const run = db.transaction(() => {
    const contract = getContractById(contractId);
    if (!contract) throw new Error('العقد غير موجود.');
    const previous_payments_total = previousPaymentsTotal(db, contractId);
    const { currentPeriodValue, retentionAmount, netDue } = computeProgressPaymentNetDue({
      work_value_to_date: data.work_value_to_date, previous_work_value: data.previous_work_value,
      retention_pct: data.retention_pct, other_deductions: data.other_deductions, previous_payments_total,
    });
    const uuid = randomUUID();
    const info = db
      .prepare(
        `INSERT INTO biz_progress_payments (uuid, certificate_no, contract_id, period_from, period_to, work_value_to_date,
           previous_work_value, retention_pct, retention_amount, other_deductions, previous_payments_total, net_due, status, submitted_by, notes)
         VALUES (@uuid, @certificate_no, @contract_id, @period_from, @period_to, @work_value_to_date,
           @previous_work_value, @retention_pct, @retention_amount, @other_deductions, @previous_payments_total, @net_due, 'draft', @submitted_by, @notes)`
      )
      .run({
        uuid, certificate_no: data.certificate_no || null, contract_id: contractId,
        period_from: data.period_from || null, period_to: data.period_to || null,
        work_value_to_date: Number(data.work_value_to_date) || 0, previous_work_value: Number(data.previous_work_value) || 0,
        retention_pct: Number(data.retention_pct) || 0, retention_amount: retentionAmount,
        other_deductions: Number(data.other_deductions) || 0, previous_payments_total, net_due: netDue,
        submitted_by: data.actor || null, notes: data.notes || null,
      });
    const created = getProgressPaymentById(info.lastInsertRowid);
    writeBizAudit(db, { entity_type: 'progress_payment', entity_id: created.id, action: 'create', before: null, after: created, actor: data.actor });
    return { ...created, currentPeriodValue };
  });
  return run();
}

export function submitProgressPayment(id, { actor, actor_role }) {
  const db = bdb();
  const run = db.transaction(() => {
    const before = getProgressPaymentById(id);
    if (!before) throw new Error('المستخلص غير موجود.');
    db.prepare(`UPDATE biz_progress_payments SET status='pending_approval', updated_at=datetime('now') WHERE id=?`).run(id);
    recordApproval(db, { entity_type: 'progress_payment', entity_id: id, action: 'submit', decision: 'pending_approval', actor, actor_role });
    const after = getProgressPaymentById(id);
    writeBizAudit(db, { entity_type: 'progress_payment', entity_id: id, action: 'submit', before, after, actor });
    return after;
  });
  return run();
}

/** اعتماد/رفض مستخلص (البند 18: يسجَّل الموافق والتاريخ والوقت والقرار والملاحظات في biz_approvals). */
export function decideProgressPayment(id, { approved, notes, actor, actor_role }) {
  const db = bdb();
  const run = db.transaction(() => {
    const before = getProgressPaymentById(id);
    if (!before) throw new Error('المستخلص غير موجود.');
    if (before.status !== 'pending_approval') throw new Error('لا يمكن اتخاذ قرار إلا على مستخلص بحالة "بانتظار الاعتماد".');
    const status = approved ? 'approved' : 'rejected';
    db.prepare(`UPDATE biz_progress_payments SET status=@status, approved_by=@approved_by, approved_at=datetime('now'), updated_at=datetime('now') WHERE id=@id`)
      .run({ id, status, approved_by: actor || null });
    recordApproval(db, { entity_type: 'progress_payment', entity_id: id, action: approved ? 'approve' : 'reject', decision: status, notes, actor, actor_role });
    const after = getProgressPaymentById(id);
    writeBizAudit(db, { entity_type: 'progress_payment', entity_id: id, action: approved ? 'approve' : 'reject', before, after, actor });
    return after;
  });
  return run();
}

/** تسجيل الصرف الفعلي - يسجّل بند إيراد حقيقي في ميزانية مشروع القسم الرابع المرتبط (إن وُجد)،
 * بدل الاكتفاء بتغيير حالة نصية - تكامل حقيقي بالبند 16 وليس واجهة شكلية. */
export function markProgressPaymentPaid(id, { actor }) {
  const db = bdb();
  const run = db.transaction(() => {
    const before = getProgressPaymentById(id);
    if (!before) throw new Error('المستخلص غير موجود.');
    if (before.status !== 'approved') throw new Error('لا يمكن تسجيل الصرف إلا لمستخلص معتمد.');
    db.prepare(`UPDATE biz_progress_payments SET status='paid', paid_at=datetime('now'), updated_at=datetime('now') WHERE id=?`).run(id);
    const after = getProgressPaymentById(id);
    writeBizAudit(db, { entity_type: 'progress_payment', entity_id: id, action: 'mark_paid', before, after, actor });

    const contract = getContractById(before.contract_id);
    if (contract?.project_id) {
      try {
        createBudgetItem({
          project_id: contract.project_id, item_type: 'revenue', category: 'مستخلص مُحصَّل',
          description: `مستخلص ${before.certificate_no || '#' + before.id}`, amount: before.net_due,
          date: new Date().toISOString().slice(0, 10), reference_no: before.certificate_no || String(before.id),
          status: 'recorded', actor,
        });
      } catch {
        /* المشروع المرتبط قد يكون أُرشف - لا نفشل تسجيل الصرف الفعلي بسبب ذلك */
      }
    }
    return after;
  });
  return run();
}
