// lib/businessApi.js — عميل واجهة القسم السادس، بنفس نمط lib/pmApi.js وlib/scheduleApi.js تماماً.
// يُعيد استخدام نفس هوية الفاعل المخزّنة في localStorage('pm_actor') بدل تكرارها لكل قسم -
// نفس الشخص/الدور واحد عبر كامل التطبيق (الأقسام 4، 5، 6).
import { getActor as getSharedActor } from './pmApi.js';

const BASE = '/api/business';

async function request(path, { method = 'GET', body, params } = {}) {
  const { actor, actor_role } = getSharedActor();
  let url = BASE + path;
  if (params) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => [k, String(v)])
    ).toString();
    if (qs) url += `?${qs}`;
  }
  const options = { method, headers: { 'x-biz-actor': actor || '', 'x-biz-actor-role': actor_role || '' } };
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
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export { getSharedActor as getActor };

// ---- لوحة التحكم ----
export const getDashboardStats = () => request('/dashboard-stats');

// ---- العملاء ----
export const listClients = (params) => request('/clients', { params });
export const getClient = (id) => request(`/clients/${id}`);
export const createClient = (body) => request('/clients', { method: 'POST', body });
export const updateClient = (id, body) => request(`/clients/${id}`, { method: 'PATCH', body });
export const setClientStatus = (id, status) => request(`/clients/${id}`, { method: 'PATCH', body: { status } });
export const deleteClient = (id) => request(`/clients/${id}`, { method: 'DELETE' });
export const listClientContacts = (id) => request(`/clients/${id}/contacts`);
export const createClientContact = (id, body) => request(`/clients/${id}/contacts`, { method: 'POST', body });
export const updateClientContact = (id, contactId, body) => request(`/clients/${id}/contacts/${contactId}`, { method: 'PATCH', body });
export const deleteClientContact = (id, contactId) => request(`/clients/${id}/contacts/${contactId}`, { method: 'DELETE' });

// ---- الفرص التجارية ----
export const listOpportunities = (params) => request('/opportunities', { params });
export const listOpenOpportunities = () => request('/opportunities', { params: { view: 'pipeline' } });
export const getOpportunity = (id) => request(`/opportunities/${id}`);
export const createOpportunity = (body) => request('/opportunities', { method: 'POST', body });
export const updateOpportunity = (id, body) => request(`/opportunities/${id}`, { method: 'PATCH', body });
export const changeOpportunityStage = (id, stage, lost_reason) => request(`/opportunities/${id}`, { method: 'PATCH', body: { action: 'change_stage', stage, lost_reason } });
export const deleteOpportunity = (id) => request(`/opportunities/${id}`, { method: 'DELETE' });

// ---- عروض الأسعار ----
export const listQuotes = (params) => request('/quotes', { params });
export const getQuote = (id) => request(`/quotes/${id}`);
export const createQuote = (body) => request('/quotes', { method: 'POST', body });
export const updateQuote = (id, body) => request(`/quotes/${id}`, { method: 'PATCH', body });
export const replaceQuoteItems = (id, items) => request(`/quotes/${id}/items`, { method: 'PUT', body: { items } });
export const transitionQuoteStatus = (id, status, opts = {}) => request(`/quotes/${id}/status`, { method: 'POST', body: { status, ...opts } });
export const convertQuoteToContract = (id, body) => request(`/quotes/${id}/convert-to-contract`, { method: 'POST', body });
export const deleteQuote = (id) => request(`/quotes/${id}`, { method: 'DELETE' });

// ---- العقود ----
export const listContracts = (params) => request('/contracts', { params });
export const getContract = (id) => request(`/contracts/${id}`);
export const createContract = (body) => request('/contracts', { method: 'POST', body });
export const updateContract = (id, body) => request(`/contracts/${id}`, { method: 'PATCH', body });
export const transitionContractStatus = (id, status, opts = {}) => request(`/contracts/${id}/status`, { method: 'POST', body: { status, ...opts } });

// ---- أوامر التغيير ----
export const listChangeOrders = (contractId) => request(`/contracts/${contractId}/change-orders`);
export const createChangeOrder = (contractId, body) => request(`/contracts/${contractId}/change-orders`, { method: 'POST', body });
export const submitChangeOrder = (contractId, coId) => request(`/contracts/${contractId}/change-orders/${coId}`, { method: 'PATCH', body: { action: 'submit' } });
export const decideChangeOrder = (contractId, coId, approved, notes) => request(`/contracts/${contractId}/change-orders/${coId}`, { method: 'PATCH', body: { action: approved ? 'approve' : 'reject', notes } });

// ---- المستخلصات والدفعات ----
export const listProgressPayments = (contractId) => request(`/contracts/${contractId}/progress-payments`);
export const createProgressPayment = (contractId, body) => request(`/contracts/${contractId}/progress-payments`, { method: 'POST', body });
export const submitProgressPayment = (contractId, ppId) => request(`/contracts/${contractId}/progress-payments/${ppId}`, { method: 'PATCH', body: { action: 'submit' } });
export const decideProgressPayment = (contractId, ppId, approved, notes) => request(`/contracts/${contractId}/progress-payments/${ppId}`, { method: 'PATCH', body: { action: approved ? 'approve' : 'reject', notes } });
export const markProgressPaymentPaid = (contractId, ppId) => request(`/contracts/${contractId}/progress-payments/${ppId}`, { method: 'PATCH', body: { action: 'pay' } });

// ---- المقاولون والموردون ----
export const listPartners = (params) => request('/partners', { params });
export const getPartner = (id) => request(`/partners/${id}`);
export const createPartner = (body) => request('/partners', { method: 'POST', body });
export const updatePartner = (id, body) => request(`/partners/${id}`, { method: 'PATCH', body });
export const setPartnerStatus = (id, status) => request(`/partners/${id}`, { method: 'PATCH', body: { status } });
export const addPartnerEvaluation = (id, body) => request(`/partners/${id}/evaluations`, { method: 'POST', body });

// ---- أوامر العمل ----
export const listWorkOrders = (params) => request('/work-orders', { params });
export const getWorkOrder = (id) => request(`/work-orders/${id}`);
export const createWorkOrder = (body) => request('/work-orders', { method: 'POST', body });
export const updateWorkOrder = (id, body) => request(`/work-orders/${id}`, { method: 'PATCH', body });
export const setWorkOrderStatus = (id, status) => request(`/work-orders/${id}`, { method: 'PATCH', body: { status } });
export const deleteWorkOrder = (id) => request(`/work-orders/${id}`, { method: 'DELETE' });

// ---- المراسلات ----
export const listCorrespondence = (params) => request('/correspondence', { params });
export const getCorrespondenceItem = (id) => request(`/correspondence/${id}`);
export const createCorrespondence = (body) => request('/correspondence', { method: 'POST', body });
export const updateCorrespondence = (id, body) => request(`/correspondence/${id}`, { method: 'PATCH', body });
export const deleteCorrespondence = (id) => request(`/correspondence/${id}`, { method: 'DELETE' });

// ---- الاجتماعات ----
export const listMeetings = (params) => request('/meetings', { params });
export const getMeeting = (id) => request(`/meetings/${id}`);
export const createMeeting = (body) => request('/meetings', { method: 'POST', body });
export const updateMeeting = (id, body) => request(`/meetings/${id}`, { method: 'PATCH', body });
export const deleteMeeting = (id) => request(`/meetings/${id}`, { method: 'DELETE' });
export const addMeetingDecision = (id, body) => request(`/meetings/${id}/decisions`, { method: 'POST', body });
export const updateDecisionStatus = (id, decId, status) => request(`/meetings/${id}/decisions/${decId}`, { method: 'PATCH', body: { status } });

// ---- الالتزامات ----
export const listCommitments = (params) => request('/commitments', { params });
export const getCommitment = (id) => request(`/commitments/${id}`);
export const createCommitment = (body) => request('/commitments', { method: 'POST', body });
export const updateCommitment = (id, body) => request(`/commitments/${id}`, { method: 'PATCH', body });
export const deleteCommitment = (id) => request(`/commitments/${id}`, { method: 'DELETE' });

// ---- المستندات ----
export const listDocuments = (entity_type, entity_id) => request('/documents', { params: { entity_type, entity_id } });
export const uploadDocument = (formData) => request('/documents', { method: 'POST', body: formData });
export const deleteDocument = (id) => request(`/documents/${id}`, { method: 'DELETE' });
export const decideDocumentApproval = (id, approved) => request(`/documents/${id}/approval`, { method: 'POST', body: { approved } });
export const documentDownloadUrl = (id) => `${BASE}/documents/${id}`;

// ---- التنبيهات ----
export const listNotifications = (params) => request('/notifications', { params });
export const markNotificationRead = (id, is_read = true) => request(`/notifications/${id}`, { method: 'PATCH', body: { is_read } });
export const markAllNotificationsRead = () => request('/notifications', { method: 'POST', body: { action: 'mark_all_read' } });

// ---- سجل التدقيق ----
export const listAuditLog = (params) => request('/audit-log', { params });

// ---- التقارير ----
export const getReport = (type, params) => request(`/reports/${type}`, { params });
export function reportDownloadUrl(type, format, params = {}) {
  const qs = new URLSearchParams({ format, ...params }).toString();
  return `${BASE}/reports/${type}?${qs}`;
}

// ---- الذكاء الاصطناعي ----
export const getAiHealth = () => request('/ai/health');
export const callBusinessAi = (action, body) => request(`/ai/${action}`, { method: 'POST', body });
