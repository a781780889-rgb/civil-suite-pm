// lib/equipmentApi.js — عميل واجهة القسم السابع (إدارة المعدات)، بنفس نمط lib/businessApi.js
// وlib/pmApi.js تماماً. يُعيد استخدام نفس هوية الفاعل المخزّنة في localStorage('pm_actor') -
// نفس الشخص/الدور واحد عبر كامل المنصة.
import { getActor as getSharedActor } from './pmApi.js';

const BASE = '/api/equipment';

async function request(path, { method = 'GET', body, params } = {}) {
  const { actor, actor_role } = getSharedActor();
  let url = BASE + path;
  if (params) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => [k, String(v)])
    ).toString();
    if (qs) url += `?${qs}`;
  }
  const options = { method, headers: { 'x-equip-actor': actor || '', 'x-equip-actor-role': actor_role || '' } };
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

// ---- التصنيفات ----
export const listCategories = (params) => request('/categories', { params });
export const listCategoryGroups = () => request('/categories/groups');
export const createCategory = (body) => request('/categories', { method: 'POST', body });
export const deleteCategory = (key) => request(`/categories/${key}`, { method: 'DELETE' });

// ---- سجل المعدات ----
export const listEquipment = (params) => request('/equipment', { params });
export const getEquipment = (id) => request(`/equipment/${id}`);
export const createEquipment = (body) => request('/equipment', { method: 'POST', body });
export const updateEquipment = (id, body) => request(`/equipment/${id}`, { method: 'PATCH', body });
export const archiveEquipment = (id) => request(`/equipment/${id}`, { method: 'DELETE' });
export const deleteEquipmentHard = (id) => request(`/equipment/${id}?mode=hard`, { method: 'DELETE' });
export const setEquipmentStatus = (id, status, note) => request(`/equipment/${id}/status`, { method: 'POST', body: { status, note } });
export const listEquipmentStatusLog = (id) => request(`/equipment/${id}/status`);
export const getEquipmentCostSummary = (id, params) => request(`/equipment/${id}/costs`, { params });

// ---- التخصيص على المشاريع ----
export const listAssignments = (params) => request('/assignments', { params });
export const createAssignment = (body) => request('/assignments', { method: 'POST', body });
export const completeAssignment = (id, end_date) => request(`/assignments/${id}`, { method: 'PATCH', body: { action: 'complete', end_date } });
export const cancelAssignment = (id) => request(`/assignments/${id}`, { method: 'PATCH', body: { action: 'cancel' } });

// ---- الحجوزات ----
export const listReservations = (params) => request('/reservations', { params });
export const createReservation = (body) => request('/reservations', { method: 'POST', body });
export const confirmReservation = (id) => request(`/reservations/${id}`, { method: 'PATCH', body: { action: 'confirm' } });
export const completeReservation = (id) => request(`/reservations/${id}`, { method: 'PATCH', body: { action: 'complete' } });
export const cancelReservation = (id) => request(`/reservations/${id}`, { method: 'PATCH', body: { action: 'cancel' } });

// ---- سجل التشغيل وعداد الساعات ----
export const listOperationLogs = (params) => request('/operations', { params });
export const createOperationLog = (body) => request('/operations', { method: 'POST', body });
export const updateOperationLogNotes = (id, body) => request(`/operations/${id}`, { method: 'PATCH', body });
export const listHourMeterReadings = (equipment_id, params) => request('/hour-meter', { params: { equipment_id, ...params } });
export const recordHourMeterReading = (body) => request('/hour-meter', { method: 'POST', body });

// ---- الوقود ----
export const listFuelLogs = (params) => request('/fuel', { params });
export const createFuelLog = (body) => request('/fuel', { method: 'POST', body });

// ---- خطط الصيانة الوقائية ----
export const listMaintenanceSchedules = (params) => request('/maintenance/schedules', { params });
export const createMaintenanceSchedule = (body) => request('/maintenance/schedules', { method: 'POST', body });
export const updateMaintenanceSchedule = (id, body) => request(`/maintenance/schedules/${id}`, { method: 'PATCH', body });
export const deactivateMaintenanceSchedule = (id) => request(`/maintenance/schedules/${id}`, { method: 'DELETE' });

// ---- سجلات الصيانة الفعلية ----
export const listMaintenanceRecords = (params) => request('/maintenance/records', { params });
export const getMaintenanceRecord = (id) => request(`/maintenance/records/${id}`);
export const createMaintenanceRecord = (body) => request('/maintenance/records', { method: 'POST', body });
export const completeMaintenanceRecord = (id, body) => request(`/maintenance/records/${id}`, { method: 'PATCH', body });

// ---- الأعطال ----
export const listBreakdowns = (params) => request('/breakdowns', { params });
export const getBreakdown = (id) => request(`/breakdowns/${id}`);
export const createBreakdown = (body) => request('/breakdowns', { method: 'POST', body });
export const updateBreakdownProgress = (id, body) => request(`/breakdowns/${id}`, { method: 'PATCH', body: { action: 'progress', ...body } });
export const resolveBreakdown = (id, body) => request(`/breakdowns/${id}`, { method: 'PATCH', body: { action: 'resolve', ...body } });

// ---- قطع الغيار ----
export const listSpareParts = (params) => request('/spare-parts', { params });
export const getSparePart = (id) => request(`/spare-parts/${id}`);
export const createSparePart = (body) => request('/spare-parts', { method: 'POST', body });
export const updateSparePart = (id, body) => request(`/spare-parts/${id}`, { method: 'PATCH', body });
export const deleteSparePart = (id) => request(`/spare-parts/${id}`, { method: 'DELETE' });
export const usePartInRecord = (body) => request('/spare-parts/usage', { method: 'POST', body });

// ---- المشغلون ----
export const listOperators = (params) => request('/operators', { params });
export const getOperator = (id) => request(`/operators/${id}`);
export const createOperator = (body) => request('/operators', { method: 'POST', body });
export const updateOperator = (id, body) => request(`/operators/${id}`, { method: 'PATCH', body });
export const deleteOperator = (id) => request(`/operators/${id}`, { method: 'DELETE' });
export const listAuthorizedOperators = (equipmentId) => request(`/equipment/${equipmentId}/operators`);
export const authorizeOperator = (equipmentId, operator_id, notes) => request(`/equipment/${equipmentId}/operators`, { method: 'POST', body: { operator_id, notes } });
export const revokeOperatorAuthorization = (equipmentId, operatorId) => request(`/equipment/${equipmentId}/operators/${operatorId}`, { method: 'DELETE' });
export const checkOperatorAuthorization = (equipmentId, operatorId) => request(`/equipment/${equipmentId}/operators/${operatorId}/check`);

// ---- نقل المعدات ----
export const listTransfers = (params) => request('/transfers', { params });
export const createTransfer = (body) => request('/transfers', { method: 'POST', body });
export const completeTransfer = (id) => request(`/transfers/${id}`, { method: 'PATCH', body: { action: 'complete' } });
export const cancelTransfer = (id) => request(`/transfers/${id}`, { method: 'PATCH', body: { action: 'cancel' } });

// ---- المعدات المؤجرة ----
export const listRentals = (params) => request('/rentals', { params });
export const createRental = (body) => request('/rentals', { method: 'POST', body });
export const updateRentalStatus = (id, contract_status) => request(`/rentals/${id}`, { method: 'PATCH', body: { contract_status } });

// ---- فحوصات السلامة ----
export const listInspections = (params) => request('/inspections', { params });
export const createInspection = (body) => request('/inspections', { method: 'POST', body });
export const approveReturnToService = (equipment_id, note) => request('/inspections/approve-return', { method: 'POST', body: { equipment_id, note } });

// ---- المستندات ----
export const listDocuments = (equipment_id) => request('/documents', { params: { equipment_id } });
export const uploadDocument = (formData) => request('/documents', { method: 'POST', body: formData });
export const deleteDocument = (id) => request(`/documents/${id}`, { method: 'DELETE' });
export const documentDownloadUrl = (id) => `${BASE}/documents/${id}`;

// ---- التنبيهات ----
export const listNotifications = (params) => request('/notifications', { params });
export const markNotificationRead = (id) => request(`/notifications/${id}`, { method: 'PATCH' });
export const markAllNotificationsRead = (equipment_id) => request('/notifications', { method: 'POST', body: { action: 'mark_all_read', equipment_id } });

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
export const callEquipmentAi = (action, body) => request(`/ai/${action}`, { method: 'POST', body });
