// lib/scheduleApi.js
// دوال مساعدة لاستدعاء واجهات القسم الخامس من مكوّنات العميل - بنفس نمط lib/pmApi.js تماماً،
// ويُعيد استخدام نفس الفاعل/الدور المحفوظ محلياً (pm_actor) لتوحيد اختيار الدور عبر المنصة كلها.
import { getActor as getSharedActor } from './pmApi.js';

function qs(params = {}) {
  const filtered = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  return new URLSearchParams(filtered).toString();
}

async function schFetch(path, { method = 'GET', body } = {}) {
  const opts = { method };
  if (method !== 'GET') {
    const { actor, actor_role } = getSharedActor();
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify({ actor, actor_role, ...(body || {}) });
  }
  const res = await fetch(`/api/schedule${path}`, opts);
  return res.json();
}

export const schSchedules = {
  list: (params = {}) => schFetch(`/schedules?${qs(params)}`),
  get: (id) => schFetch(`/schedules/${id}`),
  create: (payload) => schFetch('/schedules', { method: 'POST', body: payload }),
  update: (id, payload) => schFetch(`/schedules/${id}`, { method: 'PATCH', body: payload }),
  setPrimary: (id) => schFetch(`/schedules/${id}`, { method: 'PATCH', body: { set_primary: true } }),
  archive: (id) => schFetch(`/schedules/${id}`, { method: 'DELETE' }),
  hardDelete: (id) => schFetch(`/schedules/${id}?hard=1`, { method: 'DELETE' }),
  gantt: (id) => schFetch(`/schedules/${id}/gantt`),
  variance: (id) => schFetch(`/schedules/${id}/variance`),
  audit: (id) => schFetch(`/schedules/${id}/audit`),
};

export const schActivities = {
  list: (scheduleId) => schFetch(`/schedules/${scheduleId}/activities`),
  create: (scheduleId, payload) => schFetch(`/schedules/${scheduleId}/activities`, { method: 'POST', body: payload }),
  update: (id, payload) => schFetch(`/activities/${id}`, { method: 'PATCH', body: payload }),
  remove: (id) => schFetch(`/activities/${id}`, { method: 'DELETE' }),
  reorder: (scheduleId, items) => schFetch('/activities/reorder', { method: 'POST', body: { schedule_id: scheduleId, items } }),
  resources: (id) => schFetch(`/activities/${id}/resources`),
  assignResource: (id, payload) => schFetch(`/activities/${id}/resources`, { method: 'POST', body: payload }),
  progress: (id) => schFetch(`/activities/${id}/progress`),
  logProgress: (id, payload) => schFetch(`/activities/${id}/progress`, { method: 'POST', body: payload }),
};

export const schRelationships = {
  create: (payload) => schFetch('/relationships', { method: 'POST', body: payload }),
  update: (id, payload) => schFetch(`/relationships/${id}`, { method: 'PATCH', body: payload }),
  remove: (id) => schFetch(`/relationships/${id}`, { method: 'DELETE' }),
};

export const schActivityResources = { remove: (id) => schFetch(`/activity-resources/${id}`, { method: 'DELETE' }) };

export const schResourceConflicts = {
  all: () => schFetch('/resources/conflicts'),
  forResource: (resourceId) => schFetch(`/resources/conflicts?resource_id=${resourceId}`),
};

export const schBaselines = {
  list: (scheduleId) => schFetch(`/schedules/${scheduleId}/baselines`),
  create: (scheduleId, payload) => schFetch(`/schedules/${scheduleId}/baselines`, { method: 'POST', body: payload }),
  compare: (id) => schFetch(`/baselines/${id}`),
  remove: (id) => schFetch(`/baselines/${id}`, { method: 'DELETE' }),
};

export const schCalendars = {
  list: (projectId) => schFetch(`/calendars?${qs({ project_id: projectId })}`),
  create: (payload) => schFetch('/calendars', { method: 'POST', body: payload }),
  update: (id, payload) => schFetch(`/calendars/${id}`, { method: 'PATCH', body: payload }),
  exceptions: (id) => schFetch(`/calendars/${id}`),
  addException: (id, payload) => schFetch(`/calendars/${id}`, { method: 'POST', body: payload }),
  removeException: (id) => schFetch(`/calendar-exceptions/${id}`, { method: 'DELETE' }),
};

export const schDashboard = { stats: () => schFetch('/dashboard-stats') };

export const schReports = {
  get: (scheduleId, type, params = {}) => schFetch(`/schedules/${scheduleId}/reports/${type}?${qs(params)}`),
  exportUrl: (scheduleId, type, format) => `/api/schedule/schedules/${scheduleId}/reports/${type}?${qs({ format })}`,
};

export const schAi = {
  analyze: (scheduleId) => schFetch('/ai/analyze', { method: 'POST', body: { schedule_id: scheduleId } }),
  ask: (scheduleId, question) => schFetch('/ai/ask', { method: 'POST', body: { schedule_id: scheduleId, question } }),
};

export const ACTIVITY_TYPE_LABELS = { task: 'نشاط', milestone: 'معلَم', summary: 'ملخّص / مرحلة', level_of_effort: 'جهد مستمر' };
export const ACTIVITY_STATUS_LABELS = { not_started: 'لم يبدأ', in_progress: 'قيد التنفيذ', delayed: 'متأخر', completed: 'مكتمل', on_hold: 'معلّق' };
export const ACTIVITY_PRIORITY_LABELS = { low: 'منخفضة', medium: 'متوسطة', high: 'عالية', critical: 'حرجة' };
export const REL_TYPE_LABELS = { FS: 'نهاية → بداية (FS)', SS: 'بداية → بداية (SS)', FF: 'نهاية → نهاية (FF)', SF: 'بداية → نهاية (SF)' };
