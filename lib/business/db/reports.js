// lib/business/db/reports.js
import { bdb } from '../schema.js';

export function logBizReportGeneration(report_type, format, generated_by) {
  bdb().prepare(`INSERT INTO biz_report_log (report_type, format, generated_by) VALUES (?, ?, ?)`).run(report_type, format, generated_by || null);
}

export function listBizReportLog(limit = 50) {
  return bdb().prepare(`SELECT * FROM biz_report_log ORDER BY created_at DESC LIMIT ?`).all(limit);
}
