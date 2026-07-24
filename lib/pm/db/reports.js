// lib/pm/db/reports.js
import { pdb } from '../schema.js';

export function logReportGenerated({ project_id, report_type, format, generated_by }) {
  const info = pdb()
    .prepare(`INSERT INTO pm_report_log (project_id, report_type, format, generated_by) VALUES (?, ?, ?, ?)`)
    .run(project_id || null, report_type, format || 'view', generated_by || null);
  return pdb().prepare(`SELECT * FROM pm_report_log WHERE id = ?`).get(info.lastInsertRowid);
}

export function listRecentReports({ project_id, limit = 8 } = {}) {
  const db = pdb();
  if (project_id) {
    return db.prepare(`SELECT r.*, p.name AS project_name FROM pm_report_log r JOIN projects p ON p.id = r.project_id WHERE r.project_id = ? ORDER BY r.created_at DESC LIMIT ?`).all(project_id, limit);
  }
  return db.prepare(`SELECT r.*, p.name AS project_name FROM pm_report_log r JOIN projects p ON p.id = r.project_id ORDER BY r.created_at DESC LIMIT ?`).all(limit);
}
