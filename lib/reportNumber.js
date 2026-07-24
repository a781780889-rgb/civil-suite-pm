// lib/reportNumber.js
// دالة نقية بدون أي اعتمادية على قاعدة البيانات - آمنة للاستيراد من مكوّنات العميل والخادم معاً
export function formatReportNumber(calc) {
  const year = (calc?.created_at || '').slice(0, 4) || new Date().getFullYear();
  const idPadded = String(calc?.id ?? 0).padStart(5, '0');
  return `CS-${year}-${idPadded}`;
}
