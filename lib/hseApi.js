// lib/hseApi.js — عميل واجهة القسم الثامن (إدارة السلامة المهنية)، بنفس نمط lib/equipmentApi.js
// وlib/businessApi.js تماماً. يُعيد استخدام نفس هوية الفاعل المخزّنة في localStorage('pm_actor').
import { getActor as getSharedActor } from './pmApi.js';

const BASE = '/api/hse';

async function request(path, { method = 'GET', body, params } = {}) {
  const { actor, actor_role } = getSharedActor();
  let url = BASE + path;
  if (params) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => [k, String(v)])
    ).toString();
    if (qs) url += `?${qs}`;
  }
  const options = { method, headers: { 'x-hse-actor': actor || '', 'x-hse-actor-role': actor_role || '' } };
  if (body instanceof FormData) {
    body.set('actor', actor || '');
    body.set('actor_role', actor_role || '');
    options.body = body;
  } else if (method !== 'GET') {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify({ ...(body || {}), actor, actor_role });
  }
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const err = new Error(data.error || `فشل الطلب (${res.status})`);
    err.status = res.status; err.code = data.code; err.data = data;
    throw err;
  }
  return data;
}

export { getSharedActor as getActor };

// ---- لوحة التحكم والإشعارات ----
export const getDashboard = (params) => request('/dashboard', { params });
export const listNotifications = (params) => request('/notifications', { params });
export const markNotificationRead = (id) => request(`/notifications/${id}/read`, { method: 'POST' });
export const markAllNotificationsRead = (project_id) => request('/notifications/read-all', { method: 'POST', body: { project_id } });

// ---- مواقع العمل ----
export const listSites = (params) => request('/sites', { params });
export const getSite = (id) => request(`/sites/${id}`);
export const createSite = (body) => request('/sites', { method: 'POST', body });
export const updateSite = (id, body) => request(`/sites/${id}`, { method: 'PATCH', body });
export const deleteSite = (id) => request(`/sites/${id}`, { method: 'DELETE' });

// ---- المخاطر ----
export const listRisks = (params) => request('/risks', { params });
export const getRisk = (id) => request(`/risks/${id}`);
export const createRisk = (body) => request('/risks', { method: 'POST', body });
export const updateRisk = (id, body) => request(`/risks/${id}`, { method: 'PATCH', body });
export const deleteRisk = (id) => request(`/risks/${id}`, { method: 'DELETE' });
export const reassessRisk = (id, body) => request(`/risks/${id}/reassess`, { method: 'POST', body });
export const closeRisk = (id) => request(`/risks/${id}/close`, { method: 'POST' });

// ---- تصاريح العمل ----
export const listPermits = (params) => request('/permits', { params });
export const getPermit = (id) => request(`/permits/${id}`);
export const createPermit = (body) => request('/permits', { method: 'POST', body });
export const updatePermit = (id, body) => request(`/permits/${id}`, { method: 'PATCH', body });
export const submitPermit = (id) => request(`/permits/${id}/submit`, { method: 'POST' });
export const decidePermit = (id, decision, notes) => request(`/permits/${id}/decide`, { method: 'POST', body: { decision, notes } });
export const activatePermit = (id) => request(`/permits/${id}/activate`, { method: 'POST' });
export const closePermit = (id, closed_by) => request(`/permits/${id}/close`, { method: 'POST', body: { closed_by } });
export const cancelPermit = (id) => request(`/permits/${id}/close`, { method: 'POST', body: { cancel: true } });

// ---- التفتيشات ----
export const listInspections = (params) => request('/inspections', { params });
export const getInspection = (id) => request(`/inspections/${id}`);
export const createInspection = (body) => request('/inspections', { method: 'POST', body });
export const addInspectionItem = (id, body) => request(`/inspections/${id}/items`, { method: 'POST', body });
export const recordInspectionItemResult = (id, itemId, body) => request(`/inspections/${id}/items/${itemId}`, { method: 'PATCH', body });
export const completeInspection = (id) => request(`/inspections/${id}/complete`, { method: 'POST' });
export const approveInspection = (id, approved_by) => request(`/inspections/${id}/approve`, { method: 'POST', body: { approved_by } });
export const closeInspection = (id) => request(`/inspections/${id}/close`, { method: 'POST' });
export const reinspect = (id, body) => request(`/inspections/${id}/reinspect`, { method: 'POST', body });
export const listChecklistTemplates = (params) => request('/checklist-templates', { params });
export const createChecklistTemplate = (body) => request('/checklist-templates', { method: 'POST', body });

// ---- الحوادث والإصابات ----
export const listIncidents = (params) => request('/incidents', { params });
export const getIncident = (id) => request(`/incidents/${id}`);
export const createIncident = (body) => request('/incidents', { method: 'POST', body });
export const updateIncident = (id, body) => request(`/incidents/${id}`, { method: 'PATCH', body });
export const updateIncidentInvestigation = (id, body) => request(`/incidents/${id}/investigation`, { method: 'POST', body });
export const closeIncident = (id, closed_by) => request(`/incidents/${id}/close`, { method: 'POST', body: { closed_by } });
export const linkIncidentToNcr = (id) => request(`/incidents/${id}/link-ncr`, { method: 'POST' });

// ---- البلاغات القريبة من الحوادث ----
export const listNearMisses = (params) => request('/near-misses', { params });
export const getNearMiss = (id) => request(`/near-misses/${id}`);
export const createNearMiss = (body) => request('/near-misses', { method: 'POST', body });
export const updateNearMiss = (id, body) => request(`/near-misses/${id}`, { method: 'PATCH', body });
export const closeNearMiss = (id) => request(`/near-misses/${id}/close`, { method: 'POST' });

// ---- المخالفات ----
export const listViolations = (params) => request('/violations', { params });
export const createViolation = (body) => request('/violations', { method: 'POST', body });
export const closeViolation = (id) => request(`/violations/${id}/close`, { method: 'POST' });

// ---- الإجراءات التصحيحية ----
export const listCorrectiveActions = (params) => request('/corrective-actions', { params });
export const getCorrectiveAction = (id) => request(`/corrective-actions/${id}`);
export const createCorrectiveAction = (body) => request('/corrective-actions', { method: 'POST', body });
export const updateCorrectiveActionProgress = (id, body) => request(`/corrective-actions/${id}`, { method: 'PATCH', body });
export const approveAndCloseCorrectiveAction = (id, body) => request(`/corrective-actions/${id}/close`, { method: 'POST', body });

// ---- معدات الوقاية الشخصية ----
export const listPpeItems = (params) => request('/ppe/items', { params });
export const createPpeItem = (body) => request('/ppe/items', { method: 'POST', body });
export const adjustPpeStock = (id, delta, note) => request(`/ppe/items/${id}/adjust`, { method: 'POST', body: { delta, note } });
export const listPpeDistributions = (params) => request('/ppe/distributions', { params });
export const distributePpe = (body) => request('/ppe/distributions', { method: 'POST', body });
export const returnPpe = (id, condition) => request(`/ppe/distributions/${id}/return`, { method: 'POST', body: { condition } });

// ---- التدريب والشهادات ----
export const listTrainingCourses = (params) => request('/training/courses', { params });
export const createTrainingCourse = (body) => request('/training/courses', { method: 'POST', body });
export const listCertifications = (params) => request('/training/certifications', { params });
export const issueCertification = (body) => request('/training/certifications', { method: 'POST', body });
export const revokeCertification = (id) => request(`/training/certifications/${id}/revoke`, { method: 'POST' });

// ---- المواد الخطرة ----
export const listHazmat = (params) => request('/hazmat', { params });
export const getHazmat = (id) => request(`/hazmat/${id}`);
export const createHazmat = (body) => request('/hazmat', { method: 'POST', body });
export const updateHazmat = (id, body) => request(`/hazmat/${id}`, { method: 'PATCH', body });
export const archiveHazmat = (id) => request(`/hazmat/${id}`, { method: 'DELETE' });

// ---- معدات مكافحة الحريق ----
export const listFireEquipment = (params) => request('/fire-equipment', { params });
export const createFireEquipment = (body) => request('/fire-equipment', { method: 'POST', body });
export const listFireEquipmentChecks = (id) => request(`/fire-equipment/${id}/check`);
export const recordFireEquipmentCheck = (id, body) => request(`/fire-equipment/${id}/check`, { method: 'POST', body });

// ---- إدارة الطوارئ ----
export const listEmergencyPlans = (params) => request('/emergency/plans', { params });
export const getEmergencyPlan = (id) => request(`/emergency/plans/${id}`);
export const createEmergencyPlan = (body) => request('/emergency/plans', { method: 'POST', body });
export const updateEmergencyPlan = (id, body) => request(`/emergency/plans/${id}`, { method: 'PATCH', body });
export const listEmergencyTeams = (project_id) => request('/emergency/teams', { params: { project_id } });
export const createEmergencyTeam = (body) => request('/emergency/teams', { method: 'POST', body });
export const listEmergencyDrills = (project_id) => request('/emergency/drills', { params: { project_id } });
export const recordEmergencyDrill = (body) => request('/emergency/drills', { method: 'POST', body });

// ---- خطط السلامة (مستندات pm_documents مُعاد استخدامها) ----
export const listSafetyPlans = (params) => request('/safety-plans', { params });
export const getSafetyPlan = (id) => request(`/safety-plans/${id}`);
export const createSafetyPlan = (formData) => request('/safety-plans', { method: 'POST', body: formData });
export const addSafetyPlanVersion = (id, formData) => request(`/safety-plans/${id}/versions`, { method: 'POST', body: formData });
export const approveSafetyPlan = (id, body) => request(`/safety-plans/${id}/approve`, { method: 'POST', body });
export const deleteSafetyPlan = (id) => request(`/safety-plans/${id}`, { method: 'DELETE' });

// ---- المرفقات (صور/فيديوهات/مستندات الحوادث والتفتيش) ----
export const listAttachments = (entity_type, entity_id) => request('/attachments', { params: { entity_type, entity_id } });
export const uploadAttachment = (formData) => request('/attachments', { method: 'POST', body: formData });
export const deleteAttachment = (id) => request(`/attachments/${id}`, { method: 'DELETE' });

// ---- التقارير ----
export const reportUrl = (type, format, params = {}) => {
  const qs = new URLSearchParams({ ...params, format }).toString();
  return `${BASE}/reports/${type}?${qs}`;
};
export const fetchReportData = (type, params) => request(`/reports/${type}`, { params: { ...params, format: 'json' } });

// ---- سجل التدقيق ----
export const listAuditLog = (params) => request('/audit-log', { params });

// ---- الذكاء الاصطناعي ----
export const getHseAiHealth = () => request('/ai/health');
export const analyzeSafetyPatterns = (project_id) => request('/ai/analyze', { method: 'POST', body: { project_id } });
export const suggestPreventiveActions = (body) => request('/ai/suggest', { method: 'POST', body });
export const generateImprovementPlan = (project_id) => request('/ai/improvement-plan', { method: 'POST', body: { project_id } });
export const summarizeSafetyReport = (project_id) => request('/ai/summarize', { method: 'POST', body: { project_id } });
