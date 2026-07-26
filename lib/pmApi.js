// lib/pmApi.js
// دوال مساعدة لاستدعاء واجهات القسم الرابع من مكوّنات العميل - بنفس نمط lib/api.js
// (منفصل في ملفه الخاص نظراً لعدد نقاط النهاية الكبير في هذا القسم؛ يُرفق actor/actor_role
// تلقائياً بكل طلب مُعدِّل للبيانات من واجهة اختيار الدور المحفوظة محلياً).

function getActorInfo() {
  if (typeof window === 'undefined') return { actor: null, actor_role: 'project_manager' };
  try {
    const raw = window.localStorage.getItem('pm_actor');
    if (raw) return JSON.parse(raw);
  } catch {
    /* تجاهل */
  }
  return { actor: null, actor_role: 'project_manager' };
}

export function setActorInfo(info) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('pm_actor', JSON.stringify(info));
}

export function getActor() {
  return getActorInfo();
}

function qs(params = {}) {
  const filtered = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  return new URLSearchParams(filtered).toString();
}

async function pmFetch(path, { method = 'GET', body } = {}) {
  const opts = { method };
  if (method !== 'GET') {
    const { actor, actor_role } = getActorInfo();
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify({ actor, actor_role, ...(body || {}) });
  }
  const res = await fetch(`/api/pm${path}`, opts);
  return res.json();
}

export const pmProjects = {
  list: (params = {}) => pmFetch(`/projects?${qs(params)}`),
  get: (id) => pmFetch(`/projects/${id}`),
  create: (payload) => pmFetch('/projects', { method: 'POST', body: payload }),
  update: (id, payload) => pmFetch(`/projects/${id}`, { method: 'PATCH', body: payload }),
  archive: (id) => pmFetch(`/projects/${id}`, { method: 'DELETE' }),
  unarchive: (id) => pmFetch(`/projects/${id}`, { method: 'PATCH', body: { is_archived: false } }),
  hardDelete: (id) => pmFetch(`/projects/${id}?mode=hard`, { method: 'DELETE' }),
  changeStatus: (id, status, note) => pmFetch(`/projects/${id}/status`, { method: 'POST', body: { status, note } }),
  statusHistory: (id) => pmFetch(`/projects/${id}/status-history`),
};

export const pmPhases = {
  list: (projectId) => pmFetch(`/phases?project_id=${projectId}`),
  create: (payload) => pmFetch('/phases', { method: 'POST', body: payload }),
  update: (id, payload) => pmFetch(`/phases/${id}`, { method: 'PATCH', body: payload }),
  remove: (id) => pmFetch(`/phases/${id}`, { method: 'DELETE' }),
  reorder: (project_id, orderedIds) => pmFetch('/phases/reorder', { method: 'POST', body: { project_id, orderedIds } }),
};

export const pmTasks = {
  list: (params = {}) => pmFetch(`/tasks?${qs(params)}`),
  get: (id) => pmFetch(`/tasks/${id}`),
  create: (payload) => pmFetch('/tasks', { method: 'POST', body: payload }),
  update: (id, payload) => pmFetch(`/tasks/${id}`, { method: 'PATCH', body: payload }),
  remove: (id) => pmFetch(`/tasks/${id}`, { method: 'DELETE' }),
  addDependency: (id, payload) => pmFetch(`/tasks/${id}/dependencies`, { method: 'POST', body: payload }),
  removeDependency: (id, depId) => pmFetch(`/tasks/${id}/dependencies/${depId}`, { method: 'DELETE' }),
  comments: (id) => pmFetch(`/tasks/${id}/comments`),
  addComment: (id, comment) => pmFetch(`/tasks/${id}/comments`, { method: 'POST', body: { comment } }),
  history: (id) => pmFetch(`/tasks/${id}/history`),
};

export const pmGantt = { get: (projectId) => pmFetch(`/gantt/${projectId}`) };

export const pmTeam = {
  list: (projectId) => pmFetch(`/team?project_id=${projectId}`),
  create: (payload) => pmFetch('/team', { method: 'POST', body: payload }),
  update: (id, payload) => pmFetch(`/team/${id}`, { method: 'PATCH', body: payload }),
  remove: (id) => pmFetch(`/team/${id}`, { method: 'DELETE' }),
};

export const pmAttendance = {
  list: (params = {}) => pmFetch(`/attendance?${qs(params)}`),
  upsert: (payload) => pmFetch('/attendance', { method: 'POST', body: payload }),
  remove: (id) => pmFetch(`/attendance/${id}`, { method: 'DELETE' }),
};

export const pmBudget = {
  list: (projectId, params = {}) => pmFetch(`/budget?project_id=${projectId}&${qs(params)}`),
  create: (payload) => pmFetch('/budget', { method: 'POST', body: payload }),
  update: (id, payload) => pmFetch(`/budget/${id}`, { method: 'PATCH', body: payload }),
  remove: (id) => pmFetch(`/budget/${id}`, { method: 'DELETE' }),
  summary: (projectId) => pmFetch(`/budget/summary/${projectId}`),
};

export const pmResources = {
  list: (params = {}) => pmFetch(`/resources?${qs(params)}`),
  create: (payload) => pmFetch('/resources', { method: 'POST', body: payload }),
  update: (id, payload) => pmFetch(`/resources/${id}`, { method: 'PATCH', body: payload }),
  remove: (id) => pmFetch(`/resources/${id}`, { method: 'DELETE' }),
  conflictsFor: (id) => pmFetch(`/resources/${id}/conflicts`),
  allConflicts: () => pmFetch('/resources/conflicts'),
  assignments: (params = {}) => pmFetch(`/resources/assignments?${qs(params)}`),
  assign: (payload) => pmFetch('/resources/assignments', { method: 'POST', body: payload }),
  updateAssignment: (id, payload) => pmFetch(`/resources/assignments/${id}`, { method: 'PATCH', body: payload }),
  removeAssignment: (id) => pmFetch(`/resources/assignments/${id}`, { method: 'DELETE' }),
};

export const pmRisks = {
  list: (projectId, status) => pmFetch(`/risks?${qs({ project_id: projectId, status })}`),
  create: (payload) => pmFetch('/risks', { method: 'POST', body: payload }),
  update: (id, payload) => pmFetch(`/risks/${id}`, { method: 'PATCH', body: payload }),
  remove: (id) => pmFetch(`/risks/${id}`, { method: 'DELETE' }),
};

export const pmQuality = {
  list: (projectId, params = {}) => pmFetch(`/quality?${qs({ project_id: projectId, ...params })}`),
  create: (payload) => pmFetch('/quality', { method: 'POST', body: payload }),
  update: (id, payload) => pmFetch(`/quality/${id}`, { method: 'PATCH', body: payload }),
  remove: (id) => pmFetch(`/quality/${id}`, { method: 'DELETE' }),
};

export const pmSafety = {
  list: (projectId, params = {}) => pmFetch(`/safety?${qs({ project_id: projectId, ...params })}`),
  create: (payload) => pmFetch('/safety', { method: 'POST', body: payload }),
  update: (id, payload) => pmFetch(`/safety/${id}`, { method: 'PATCH', body: payload }),
  remove: (id) => pmFetch(`/safety/${id}`, { method: 'DELETE' }),
};

export const pmDocuments = {
  list: (projectId, params = {}) => pmFetch(`/documents?${qs({ project_id: projectId, ...params })}`),
  get: (id) => pmFetch(`/documents/${id}`),
  upload: async (formData) => {
    const { actor, actor_role } = getActorInfo();
    formData.append('actor', actor || '');
    formData.append('actor_role', actor_role);
    const res = await fetch('/api/pm/documents', { method: 'POST', body: formData });
    return res.json();
  },
  addVersion: async (id, formData) => {
    const { actor, actor_role } = getActorInfo();
    formData.append('actor', actor || '');
    formData.append('actor_role', actor_role);
    const res = await fetch(`/api/pm/documents/${id}/versions`, { method: 'POST', body: formData });
    return res.json();
  },
  update: (id, payload) => pmFetch(`/documents/${id}`, { method: 'PATCH', body: payload }),
  remove: (id) => pmFetch(`/documents/${id}`, { method: 'DELETE' }),
  approve: (id, approved, notes) => pmFetch(`/documents/${id}/approval`, { method: 'POST', body: { approved, notes } }),
  downloadUrl: (id) => `/api/pm/documents/${id}/download`,
};

export const pmMeetings = {
  list: (projectId) => pmFetch(`/meetings?project_id=${projectId}`),
  create: (payload) => pmFetch('/meetings', { method: 'POST', body: payload }),
  update: (id, payload) => pmFetch(`/meetings/${id}`, { method: 'PATCH', body: payload }),
  remove: (id) => pmFetch(`/meetings/${id}`, { method: 'DELETE' }),
  decisions: (id) => pmFetch(`/meetings/${id}/decisions`),
  addDecision: (id, payload) => pmFetch(`/meetings/${id}/decisions`, { method: 'POST', body: payload }),
};

export const pmDecisions = {
  updateStatus: (id, status) => pmFetch(`/decisions/${id}`, { method: 'PATCH', body: { status } }),
  remove: (id) => pmFetch(`/decisions/${id}`, { method: 'DELETE' }),
};

export const pmNotifications = {
  list: (params = {}) => pmFetch(`/notifications?${qs(params)}`),
  markRead: (id) => pmFetch(`/notifications/${id}`, { method: 'PATCH', body: { is_read: true } }),
  markAllRead: (projectId) => pmFetch('/notifications', { method: 'PATCH', body: { project_id: projectId } }),
};

export const pmAudit = { list: (params = {}) => pmFetch(`/audit-log?${qs(params)}`) };

export const pmDashboard = { stats: () => pmFetch('/dashboard-stats') };

export const pmReports = {
  get: (type, projectId, params = {}) => pmFetch(`/reports/${type}?${qs({ project_id: projectId, ...params })}`),
  exportUrl: (type, projectId, format, params = {}) => `/api/pm/reports/${type}?${qs({ project_id: projectId, format, ...params })}`,
};

export const pmAi = {
  health: (projectId) => pmFetch('/ai/health', { method: 'POST', body: { project_id: projectId } }),
  ask: (projectId, question) => pmFetch('/ai/ask', { method: 'POST', body: { project_id: projectId, question } }),
  meetingSummary: (meetingId) => pmFetch('/ai/meeting-summary', { method: 'POST', body: { meeting_id: meetingId } }),
  reportNarrative: (reportType, data) => pmFetch('/ai/report-narrative', { method: 'POST', body: { reportType, data } }),
};

export const pmRolesApi = { matrix: () => pmFetch('/roles') };

export const PROJECT_STATUS_LABELS = {
  planning: 'قيد التخطيط', in_progress: 'قيد التنفيذ', stopped: 'متوقف', completed: 'مكتمل', cancelled: 'ملغي', archived: 'مؤرشف',
};
export const PROJECT_PRIORITY_LABELS = { low: 'منخفضة', medium: 'متوسطة', high: 'عالية', critical: 'حرجة' };
export const TASK_STATUS_LABELS = { not_started: 'لم تبدأ', in_progress: 'قيد التنفيذ', delayed: 'متأخرة', completed: 'مكتملة', on_hold: 'معلّقة' };
export const ROLE_LABELS = {
  system_admin: 'مدير النظام', projects_manager: 'مدير المشاريع', project_manager: 'مدير المشروع',
  planning_engineer: 'مهندس التخطيط', engineer: 'المهندس',
  supervisor: 'المشرف', accountant: 'المحاسب', quality_officer: 'مسؤول الجودة', safety_officer: 'مسؤول السلامة',
  client: 'العميل', technician: 'فني', worker: 'عامل', contractor_rep: 'ممثل المقاول', supplier_rep: 'ممثل المورد', consultant_rep: 'ممثل الاستشاري',
};
