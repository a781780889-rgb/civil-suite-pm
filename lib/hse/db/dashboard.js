// lib/hse/db/dashboard.js
// يجمّع أرقام حقيقية من كل جداول القسم الثامن ويمرّرها لصيغ lib/hse/kpis.js (البند 16 والوثيقة
// الأولى: قائمة مؤشرات لوحة التحكم) - لا رقم واحد هنا محسوب يدوياً أو مفترضاً؛ كل شيء SELECT
// حقيقي على hse_* (وpm_attendance لساعات العمل الفعلية اللازمة لمعدلي التكرار والشدة).
import { hdb } from '../schema.js';
import {
  computeIncidentFrequencyRate, computeSeverityRate, computeClosureRate,
  computeTrainingComplianceRate, computeOverallComplianceScore,
} from '../kpis.js';

export function getHseDashboard({ project_id, from, to } = {}) {
  const db = hdb();
  const projFilter = project_id ? ' AND project_id = @project_id' : '';
  const dateFilterIncident = (from && to) ? ' AND incident_date BETWEEN @from AND @to' : '';
  const params = { project_id: project_id || null, from: from || null, to: to || null };

  const totalProjects = db.prepare(`SELECT COUNT(DISTINCT id) AS c FROM projects`).get().c;
  const projectsWithOpenCriticalRisk = db.prepare(`SELECT COUNT(DISTINCT project_id) AS c FROM hse_risks WHERE risk_level='critical' AND status != 'closed'`).get().c;
  const projectsCompliant = Math.max(totalProjects - projectsWithOpenCriticalRisk, 0);

  const incidentCount = db.prepare(`SELECT COUNT(*) AS c FROM hse_incidents WHERE 1=1${projFilter}${dateFilterIncident}`).get(params).c;
  const incidentsForInjuries = db.prepare(`SELECT affected_persons FROM hse_incidents WHERE 1=1${projFilter}${dateFilterIncident}`).all(params);
  const injuryCount = incidentsForInjuries.reduce((sum, r) => sum + (JSON.parse(r.affected_persons || '[]').length), 0);
  const lostDays = incidentsForInjuries.reduce((sum, r) => {
    const persons = JSON.parse(r.affected_persons || '[]');
    return sum + persons.reduce((s, p) => s + (Number(p.lost_days) || 0), 0);
  }, 0);

  const violationCount = db.prepare(`SELECT COUNT(*) AS c FROM hse_violations WHERE 1=1${projFilter}`).get(params).c;
  const openViolationCount = db.prepare(`SELECT COUNT(*) AS c FROM hse_violations WHERE status='open'${projFilter}`).get(params).c;
  const inspectionsCompleted = db.prepare(`SELECT COUNT(*) AS c FROM hse_inspections WHERE status IN ('completed','approved','closed')${projFilter}`).get(params).c;
  const inspectionsTotal = db.prepare(`SELECT COUNT(*) AS c FROM hse_inspections WHERE 1=1${projFilter}`).get(params).c;
  const activePermits = db.prepare(`SELECT COUNT(*) AS c FROM hse_permits WHERE status IN ('approved','active')${projFilter}`).get(params).c;
  const emergencyDrillsCount = db.prepare(`SELECT COUNT(*) AS c FROM hse_emergency_drills WHERE 1=1${projFilter}`).get(params).c;
  const ppeRegisteredCount = db.prepare(`SELECT COALESCE(SUM(quantity_on_hand),0) AS c FROM hse_ppe_items WHERE is_archived = 0`).get().c;
  const nearMissCount = db.prepare(`SELECT COUNT(*) AS c FROM hse_near_misses WHERE 1=1${projFilter}`).get(params).c;
  const criticalRiskCount = db.prepare(`SELECT COUNT(*) AS c FROM hse_risks WHERE risk_level='critical' AND status != 'closed'${projFilter}`).get(params).c;

  // ساعات العمل الفعلية من الحضور الحقيقي (pm_attendance) - أساس معدلي التكرار والشدة القياسيين
  const hoursRow = db.prepare(
    `SELECT COALESCE(SUM(a.hours),0) AS total_hours FROM pm_attendance a WHERE 1=1
     ${project_id ? ' AND a.project_id = @project_id' : ''} ${(from && to) ? ' AND a.date BETWEEN @from AND @to' : ''}`
  ).get(params);
  const totalManHours = hoursRow.total_hours;

  const frequencyRate = computeIncidentFrequencyRate({ recordableIncidents: incidentCount, totalManHours });
  const severityRate = computeSeverityRate({ totalLostDays: lostDays, totalManHours });

  const caTotal = db.prepare(`SELECT COUNT(*) AS c FROM hse_corrective_actions WHERE 1=1${projFilter}`).get(params).c;
  const caClosed = db.prepare(`SELECT COUNT(*) AS c FROM hse_corrective_actions WHERE status='closed'${projFilter}`).get(params).c;
  const closureRate = computeClosureRate({ closedCount: caClosed, totalCount: caTotal });

  const inspectionOnTimeRate = computeClosureRate({ closedCount: inspectionsCompleted, totalCount: inspectionsTotal });

  const certsTotal = db.prepare(`SELECT COUNT(*) AS c FROM hse_training_certifications`).get().c;
  const certsValid = db.prepare(`SELECT COUNT(*) AS c FROM hse_training_certifications WHERE status='valid' AND (expiry_date IS NULL OR expiry_date >= date('now'))`).get().c;
  const trainingComplianceRate = computeTrainingComplianceRate({ validCertifications: certsValid, totalRequired: certsTotal });

  const overallComplianceScore = computeOverallComplianceScore({ closureRate, inspectionOnTimeRate, trainingComplianceRate });

  const recentNotifications = db.prepare(
    `SELECT * FROM hse_notifications WHERE 1=1${projFilter} ORDER BY created_at DESC LIMIT 8`
  ).all(params);
  const recentInspections = db.prepare(
    `SELECT * FROM hse_inspections WHERE 1=1${projFilter} ORDER BY inspection_date DESC LIMIT 8`
  ).all(params);

  return {
    totals: {
      total_projects: totalProjects,
      projects_compliant: projectsCompliant,
      incident_count: incidentCount,
      injury_count: injuryCount,
      violation_count: violationCount,
      open_violation_count: openViolationCount,
      inspections_completed: inspectionsCompleted,
      inspections_total: inspectionsTotal,
      active_permits: activePermits,
      emergency_cases: emergencyDrillsCount,
      ppe_registered: ppeRegisteredCount,
      near_miss_count: nearMissCount,
      critical_risk_count: criticalRiskCount,
    },
    kpis: {
      compliance_rate: overallComplianceScore,
      incident_frequency_rate: frequencyRate,
      incident_severity_rate: severityRate,
      corrective_action_closure_rate: closureRate,
      inspection_completion_rate: inspectionOnTimeRate,
      training_compliance_rate: trainingComplianceRate,
      total_man_hours: totalManHours,
    },
    recent_notifications: recentNotifications,
    recent_inspections: recentInspections,
  };
}
