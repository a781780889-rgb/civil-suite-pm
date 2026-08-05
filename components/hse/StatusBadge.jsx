'use client';
// components/hse/StatusBadge.jsx — نفس نمط components/equipment/StatusBadge.jsx تماماً.
const STATUS_STYLES = {
  // عام
  open: 'bg-warnclr-50 text-warnclr-700', active: 'bg-pass-50 text-pass-700', closed: 'bg-concrete-200 text-ink-soft',
  draft: 'bg-concrete-200 text-ink-soft', pending_approval: 'bg-warnclr-50 text-warnclr-700', approved: 'bg-pass-50 text-pass-700',
  rejected: 'bg-fail-50 text-fail-700', cancelled: 'bg-concrete-200 text-ink-soft', expired: 'bg-fail-50 text-fail-700',
  reported: 'bg-warnclr-50 text-warnclr-700', investigating: 'bg-navy-50 text-navy-700', corrective_action: 'bg-warnclr-50 text-warnclr-700',
  mitigating: 'bg-navy-50 text-navy-700', reassessed: 'bg-navy-50 text-navy-700',
  in_progress: 'bg-navy-50 text-navy-700', completed: 'bg-pass-50 text-pass-700', verified: 'bg-pass-50 text-pass-700',
  issued: 'bg-navy-50 text-navy-700', returned: 'bg-concrete-200 text-ink-soft', replaced: 'bg-concrete-200 text-ink-soft',
  valid: 'bg-pass-50 text-pass-700', revoked: 'bg-fail-50 text-fail-700',
  compliant: 'bg-pass-50 text-pass-700', non_compliant: 'bg-fail-50 text-fail-700', pass_with_notes: 'bg-warnclr-50 text-warnclr-700', pending: 'bg-concrete-200 text-ink-soft',
  needs_service: 'bg-warnclr-50 text-warnclr-700', out_of_service: 'bg-fail-50 text-fail-700',
  good: 'bg-pass-50 text-pass-700', damaged: 'bg-fail-50 text-fail-700',
};

const STATUS_LABELS = {
  open: 'مفتوح', active: 'نشط', closed: 'مغلق', draft: 'مسودة', pending_approval: 'بانتظار الاعتماد', approved: 'معتمَد',
  rejected: 'مرفوض', cancelled: 'ملغى', expired: 'منتهي', reported: 'مُبلَّغ عنه', investigating: 'قيد التحقيق',
  corrective_action: 'إجراء تصحيحي', mitigating: 'قيد المعالجة', reassessed: 'أُعيد تقييمه', in_progress: 'قيد التنفيذ',
  completed: 'مكتمل', verified: 'تم التحقق', issued: 'مُسلَّمة', returned: 'مُعادة', replaced: 'مُستبدَلة', valid: 'سارية',
  revoked: 'ملغاة', compliant: 'مطابق', non_compliant: 'غير مطابق', pass_with_notes: 'مطابق مع ملاحظات', pending: 'قيد الانتظار',
  needs_service: 'يحتاج صيانة', out_of_service: 'خارج الخدمة', good: 'جيدة', damaged: 'تالفة',
};

export function StatusBadge({ status, small }) {
  const cls = STATUS_STYLES[status] || 'bg-concrete-200 text-ink-soft';
  const label = STATUS_LABELS[status] || status || '-';
  return <span className={`inline-flex items-center rounded-full font-medium ${small ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'} ${cls}`}>{label}</span>;
}

const RISK_LEVEL_STYLES = {
  low: 'bg-pass-50 text-pass-700 border-pass-200', medium: 'bg-warnclr-50 text-warnclr-700 border-warnclr-200',
  high: 'bg-[#FCEAE0] text-[#B04A18] border-[#F0C7AE]', critical: 'bg-fail-50 text-fail-700 border-fail-200',
};
const RISK_LEVEL_LABELS = { low: 'منخفض', medium: 'متوسط', high: 'مرتفع', critical: 'حرج' };

export function RiskLevelBadge({ level, small }) {
  const cls = RISK_LEVEL_STYLES[level] || 'bg-concrete-200 text-ink-soft border-line';
  return (
    <span className={`inline-flex items-center rounded-full border font-semibold ${small ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'} ${cls}`}>
      {RISK_LEVEL_LABELS[level] || level || '-'}
    </span>
  );
}

const SEVERITY_STYLES = { low: 'bg-pass-50 text-pass-700', medium: 'bg-warnclr-50 text-warnclr-700', high: 'bg-[#FCEAE0] text-[#B04A18]', critical: 'bg-fail-50 text-fail-700', minor: 'bg-pass-50 text-pass-700', moderate: 'bg-warnclr-50 text-warnclr-700', major: 'bg-[#FCEAE0] text-[#B04A18]' };
const SEVERITY_LABELS = { low: 'منخفضة', medium: 'متوسطة', high: 'عالية', critical: 'حرجة', minor: 'بسيطة', moderate: 'متوسطة', major: 'كبيرة' };

export function SeverityBadge({ severity, small }) {
  const cls = SEVERITY_STYLES[severity] || 'bg-concrete-200 text-ink-soft';
  return <span className={`inline-flex items-center rounded-full font-medium ${small ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'} ${cls}`}>{SEVERITY_LABELS[severity] || severity || '-'}</span>;
}
