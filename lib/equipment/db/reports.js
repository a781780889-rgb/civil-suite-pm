// lib/equipment/db/reports.js
// سجل توليد التقارير - تتبّع بسيط لمن ولّد أي تقرير ومتى (يُستدعى من مسار reports/[type]).
import { edb } from '../schema.js';

export function logReportGeneration({ equipment_id = null, report_type, format = 'view', generated_by = null }) {
  edb().prepare(`INSERT INTO equipment_report_log (equipment_id, report_type, format, generated_by) VALUES (?, ?, ?, ?)`)
    .run(equipment_id, report_type, format, generated_by);
}

export function listReportLog({ page = 1, pageSize = 30 } = {}) {
  const db = edb();
  const size = Math.min(200, Math.max(1, Number(pageSize) || 30));
  const offset = (Math.max(1, Number(page) || 1) - 1) * size;
  const total = db.prepare(`SELECT COUNT(*) AS n FROM equipment_report_log`).get().n;
  const rows = db.prepare(`SELECT * FROM equipment_report_log ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(size, offset);
  return { rows, total, page: Math.max(1, Number(page) || 1), pageSize: size };
}
