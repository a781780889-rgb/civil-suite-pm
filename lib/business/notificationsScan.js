// lib/business/notificationsScan.js — يربط استعلامات قاعدة البيانات الحية ببُناة التنبيهات
// النقية في lib/business/notifications.js، ثم يُخزّن النتائج (بترشيح تكرار عبر dedup_key).
import { bdb } from './schema.js';
import { upsertBizNotification } from './db/notifications.js';
import {
  buildContractExpiryNotification, buildQuoteExpiryNotification, buildOpportunityFollowupNotification,
  buildPaymentOverdueNotification, buildCommitmentOverdueNotification, buildApprovalNeededNotification,
} from './notifications.js';

export function runBusinessNotificationScan() {
  const db = bdb();
  const today = new Date().toISOString().slice(0, 10);
  let created = 0;
  const consider = (n) => { if (n && upsertBizNotification(n)) created += 1; };

  for (const c of db.prepare(`SELECT * FROM biz_contracts WHERE status = 'active'`).all()) {
    consider(buildContractExpiryNotification(c, today));
  }
  for (const q of db.prepare(`SELECT * FROM biz_quotes WHERE status IN ('sent','under_review','negotiation')`).all()) {
    consider(buildQuoteExpiryNotification(q, today));
  }
  for (const o of db.prepare(`SELECT * FROM biz_opportunities WHERE stage NOT IN ('won','lost')`).all()) {
    consider(buildOpportunityFollowupNotification(o, today));
  }
  const contractsById = new Map(db.prepare(`SELECT id, title FROM biz_contracts`).all().map((c) => [c.id, c]));
  for (const p of db.prepare(`SELECT * FROM biz_progress_payments WHERE status NOT IN ('approved','paid','rejected')`).all()) {
    consider(buildPaymentOverdueNotification(p, contractsById.get(p.contract_id), today));
  }
  for (const co of db.prepare(`SELECT * FROM biz_change_orders WHERE status = 'pending_approval'`).all()) {
    consider(buildApprovalNeededNotification({ entityType: 'change_order', entityLabel: `أمر تغيير ${co.co_no || '#' + co.id}`, id: co.id, contractTitle: contractsById.get(co.contract_id)?.title }));
  }
  for (const p of db.prepare(`SELECT * FROM biz_progress_payments WHERE status = 'pending_approval'`).all()) {
    consider(buildApprovalNeededNotification({ entityType: 'progress_payment', entityLabel: `مستخلص ${p.certificate_no || '#' + p.id}`, id: p.id, contractTitle: contractsById.get(p.contract_id)?.title }));
  }
  for (const cm of db.prepare(`SELECT * FROM biz_commitments WHERE status IN ('open','overdue')`).all()) {
    consider(buildCommitmentOverdueNotification(cm, today));
  }

  return { scannedAt: new Date().toISOString(), newNotifications: created };
}
