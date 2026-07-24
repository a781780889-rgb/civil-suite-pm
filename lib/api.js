// lib/api.js
// دوال مساعدة لاستدعاء واجهات الـ API من مكوّنات العميل (Client Components)

export async function runCalculation(calc_type, inputs) {
  const res = await fetch('/api/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ calc_type, inputs }),
  });
  const data = await res.json();
  return data;
}

export async function saveCalculation(payload) {
  const res = await fetch('/api/calculations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function fetchCalculations(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/calculations${qs ? `?${qs}` : ''}`);
  return res.json();
}

export async function fetchCalculation(id) {
  const res = await fetch(`/api/calculations/${id}`);
  return res.json();
}

export async function deleteCalculationApi(id) {
  const res = await fetch(`/api/calculations/${id}`, { method: 'DELETE' });
  return res.json();
}

export async function fetchProjects() {
  const res = await fetch('/api/projects');
  return res.json();
}

export async function createProjectApi(payload) {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function fetchDashboardStats() {
  const res = await fetch('/api/dashboard-stats');
  return res.json();
}

export async function fetchRebarDashboardStats() {
  const res = await fetch('/api/rebar-dashboard-stats');
  return res.json();
}

export async function fetchPriceLists() {
  const res = await fetch('/api/prices');
  return res.json();
}

export async function savePriceList(payload) {
  const res = await fetch('/api/prices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function deletePriceListApi(id) {
  const res = await fetch(`/api/prices/${id}`, { method: 'DELETE' });
  return res.json();
}

// =====================================================================
// القسم الثالث: نظام حصر الكميات (BOQ)
// =====================================================================

export async function fetchBoqCategories() {
  const res = await fetch('/api/boq/categories');
  return res.json();
}

export async function createBoqCategoryApi(payload) {
  const res = await fetch('/api/boq/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return res.json();
}

export async function fetchBoqElements(params = {}) {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  const qs = new URLSearchParams(clean).toString();
  const res = await fetch(`/api/boq/elements${qs ? `?${qs}` : ''}`);
  return res.json();
}

export async function fetchBoqElement(id) {
  const res = await fetch(`/api/boq/elements/${id}`);
  return res.json();
}

export async function previewBoqElementCalc(payload) {
  const res = await fetch('/api/boq/elements/calculate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return res.json();
}

export async function createBoqElementApi(payload) {
  const res = await fetch('/api/boq/elements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return res.json();
}

export async function updateBoqElementApi(id, payload) {
  const res = await fetch(`/api/boq/elements/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return res.json();
}

export async function deleteBoqElementApi(id) {
  const res = await fetch(`/api/boq/elements/${id}`, { method: 'DELETE' });
  return res.json();
}

export async function fetchBoqDashboardStats(projectId) {
  const qs = projectId ? `?project_id=${projectId}` : '';
  const res = await fetch(`/api/boq/dashboard-stats${qs}`);
  return res.json();
}

export async function fetchBoqPrices(projectId) {
  const qs = projectId ? `?project_id=${projectId}` : '';
  const res = await fetch(`/api/boq/prices${qs}`);
  return res.json();
}

export async function saveBoqPriceApi(payload) {
  const res = await fetch('/api/boq/prices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return res.json();
}

export async function updateBoqPriceApi(id, payload) {
  const res = await fetch(`/api/boq/prices/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return res.json();
}

export async function deleteBoqPriceApi(id) {
  const res = await fetch(`/api/boq/prices/${id}`, { method: 'DELETE' });
  return res.json();
}

export async function previewBoqImport(file, extra = {}) {
  const formData = new FormData();
  formData.append('file', file);
  Object.entries(extra).forEach(([k, v]) => formData.append(k, v));
  const res = await fetch('/api/boq/import/preview', { method: 'POST', body: formData });
  return res.json();
}

export async function buildBoqRowsFromGeometry(items) {
  const res = await fetch('/api/boq/import/from-geometry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) });
  return res.json();
}

export async function confirmBoqImport(payload) {
  const res = await fetch('/api/boq/import/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return res.json();
}

export function boqImportTemplateUrl(format = 'excel') {
  return `/api/boq/import/template?format=${format}`;
}

export function boqExportUrl(format, projectId) {
  const qs = projectId ? `?project_id=${projectId}` : '';
  return `/api/boq/export/${format}${qs}`;
}

export async function fetchBoqLinkedCalculations(kind, projectId) {
  const qs = new URLSearchParams({ kind, ...(projectId ? { project_id: projectId } : {}) }).toString();
  const res = await fetch(`/api/boq/linked-calculations?${qs}`);
  return res.json();
}

export async function analyzeDrawingApi(payload) {
  const res = await fetch('/api/boq/ai/analyze-drawing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return res.json();
}

export async function fetchBoqAuditLog(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/boq/audit-log${qs ? `?${qs}` : ''}`);
  return res.json();
}
